# Formatting and event delivery

Primary sources: [outputFormatting.ts](../../../utils/task/outputFormatting.ts) and [sdkProgress.ts](../../../utils/task/sdkProgress.ts). Supporting boundaries are [TaskOutputTool](../../../tools/TaskOutputTool/TaskOutputTool.tsx), [sdkEventQueue.ts](../../../utils/sdkEventQueue.ts), and concrete task notification helpers.

## Four distinct delivery paths

| Path | Producer and payload | Consumer / purpose |
|---|---|---|
| Shell tool progress | `TaskOutput` samples output; Bash/PowerShell forward a progress callback | Tool execution/UI progress, through the tool orchestration stream |
| Task output retrieval | `TaskOutputTool` reads task state and output | A model-facing tool result containing output and status |
| Task completion notification | Concrete task implementation enqueues XML via `enqueuePendingNotification()` | Conversation notification path; headless code can translate it into SDK completion events |
| SDK lifecycle/progress | `registerTask()` emits start; `emitTaskProgress()` emits usage/progress | Noninteractive output via `enqueueSdkEvent()` and `drainSdkEvents()` |

These paths are not interchangeable. SDK progress is not a queue of shell output chunks. Output retrieval does not itself subscribe to every progress event. `framework.generateTaskAttachments()` does not currently produce completion attachments.

## `outputFormatting.ts`: presentation after retrieval

`getMaxTaskOutputLength()` reads `TASK_MAX_OUTPUT_LENGTH` through `validateBoundedIntEnvVar()`:

- Default: 32,000.
- Upper limit: 160,000.
- Missing value uses the default; invalid or nonpositive parsed values also fall back, with a debug message.
- Values above the upper limit are capped. The validator uses `parseInt(value, 10)`, not strict whole-string integer validation.

`formatTaskOutput(output, taskId)` compares `output.length` to the effective limit. If it fits, it returns the original content and `wasTruncated: false`. Otherwise it builds:

```text
[Truncated. Full output: <task output path>]

<tail of output>
```

It subtracts the header length from the limit and takes the corresponding string suffix, returning `wasTruncated: true`. This is a JavaScript string-length limit, not a byte or token limit, and it does not modify the stored file.

### Small-limit edge case

The implementation does not clamp `availableSpace = maxLen - header.length` to a positive value. If the configured limit is no larger than the header, `output.slice(-availableSpace)` does not enforce the intended total cap (`slice(-0)` returns the whole string). The doc comment's “fit within the limit” statement therefore has this edge case in the current code.

## Retrieval caller

`TaskOutputTool.call()` first requires a task in `AppState.tasks`; an existing disk file alone does not satisfy that lookup. With nonblocking input it returns current state and output. With blocking input it polls status every 100 ms until terminal state, timeout, disappearance, or abort.

Terminal retrieval marks the task `notified: true`; a still-running timeout does not. This notification bookkeeping can later permit framework eviction. It is not an instruction to delete the output file.

`getTaskOutputData()` uses a local shell's live `TaskOutput` object while that object is still available, combining its stdout/stderr getters. Once the shell wrapper has been released, it falls back to the disk reader. Other task types initially use the disk reader. For local agents it then prefers text extracted from the in-memory final assistant result when available, because the output path can be a symlink to the entire JSONL transcript. An empty clean answer falls back to disk output. Remote-agent output remains the disk content; the task's command is included separately as `prompt`.

The tool's model-result mapping then uses `formatTaskOutput()`. Reading and formatting are two different bounds: when retrieval uses `getTaskOutput()`, it first reads at most an 8 MiB tail by default; formatting can further reduce that string to the configured model-facing length. A live shell capture instead follows the getter rules in [output capture](./task-output.md).

## `sdkProgress.ts`: encode already-computed metrics

`emitTaskProgress(params)` does not read task state or output files. Callers supply task/tool IDs, description, start time, tokens, tool-use count, and optional last-tool name, summary, or workflow changes. The helper creates:

```ts
{
  type: 'system',
  subtype: 'task_progress',
  task_id: params.taskId,
  tool_use_id: params.toolUseId,
  description: params.description,
  usage: {
    total_tokens: params.totalTokens,
    tool_uses: params.toolUses,
    duration_ms: Date.now() - params.startTime,
  },
  last_tool_name: params.lastToolName,
  summary: params.summary,
  workflow_progress: params.workflowProgress,
}
```

Duration is elapsed wall time from the caller's timestamp; this helper does not subtract task pause duration. It does not throttle, aggregate, mutate `AppState`, or verify that a task is still running.

Verified callers include the local-agent implementation and the wrapper in [agentToolUtils.ts](../../../tools/AgentTool/agentToolUtils.ts), which derives metrics from a progress tracker. The helper accepts workflow batches; its comment describes workflow use, but the inspected tree's direct references are agent callers. Do not infer an additional concrete caller solely from that comment.

## SDK queue semantics

`enqueueSdkEvent()` in `sdkEventQueue.ts` drops events immediately outside noninteractive sessions. In headless mode it appends to an array capped at 1,000 entries; when full, it removes the oldest event before appending the new one. There is no producer backpressure or per-task priority policy here.

`drainSdkEvents()` removes all queued events in order and adds a generated UUID and the current session ID to each. Those fields are assigned at drain time, not at enqueue time. `cli/print.ts` calls the drain at its output boundaries.

```mermaid
sequenceDiagram
    participant Owner as Task owner
    participant Helper as emitTaskProgress
    participant Queue as SDK event queue
    participant Print as cli/print
    participant Client as SDK client
    Owner->>Helper: Computed counters and startTime
    Helper->>Helper: Build task_progress; compute duration
    Helper->>Queue: enqueueSdkEvent(event)
    alt Interactive session
        Queue->>Queue: Discard event
    else Noninteractive session
        Queue->>Queue: Drop oldest if full; append
        Print->>Queue: drainSdkEvents()
        Queue-->>Print: Events with UUID and session_id
        Print-->>Client: Emit through headless output
    end
```

A queue does not automatically guarantee lossless delivery: this one intentionally drops old entries at capacity. Its policy differs both from the Bash latest-snapshot signal and from the tool orchestration `Stream`'s unbounded queue.

## Completion notification ownership

`LocalShellTask` and agent task implementations own completion notifications. They update task state and use their notification guards to avoid redundant model notifications. The framework retains an XML notification helper, but its current empty attachment list does not drive that helper.

`emitTaskTerminatedSdk()` is a separate utility for terminal paths that suppress the XML notification. Its contract warns callers not to emit both channels for the same termination: the headless XML parser can already produce the SDK completion event. Foreground agent completion is one reason to send the SDK event directly without triggering another model turn.

The identifiers serve different purposes: `task_id` identifies the long-lived task, while `tool_use_id` associates it with the invocation that created or exposed it. A task can continue after that tool invocation has returned a background-task handle.

## Limits and units at a glance

| Layer | Default / bound | Unit and behavior |
|---|---|---|
| File progress sample | 4,096 | Bytes read from tail each poll |
| File progress cadence | 1,000 | Milliseconds; shared timer, no read overlap guard |
| Pipe memory threshold | `8 * 1024 * 1024` | String code units in enforcement |
| Shell final prefix | 30,000 default, 150,000 upper | `BASH_MAX_OUTPUT_LENGTH`, passed as a byte read limit |
| Task disk retrieval | `8 * 1024 * 1024` | Bytes from tail or delta range |
| Model task-output formatting | 32,000 default, 160,000 upper | `TASK_MAX_OUTPUT_LENGTH`, string code units |
| Disk writer cap | `5 * 1024 * 1024 * 1024` | Coarse string-unit counter; drops later chunks |
| Background file watchdog | Same numeric default cap | Actual stat bytes; periodically kills oversized child |
| SDK queue | 1,000 | Events; oldest dropped at capacity |

These are independent controls. Changing the model formatting limit does not change child output storage, the progress sample, or the SDK queue size.
