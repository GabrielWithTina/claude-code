# CronListTool Internals

Source: [tools/ScheduleCronTool/CronListTool.ts](../../../../../tools/ScheduleCronTool/CronListTool.ts). Line ranges refer to this recovered source snapshot; symbols are the stable navigation handles.

## Purpose and caller boundary

Lists cron registrations from a strict empty input. Deferred, read-only, and concurrency-safe, it returns job summaries rather than scheduler execution history or next-fire timestamps.

The [shared invocation lifecycle](../../invocation-lifecycle.md) explains registry selection, schema validation, authorization, hooks, result mapping, and exception handling. The sequence below begins with a model tool request and ends at the parent conversation boundary; external services and background workers retain their own lifecycles.

## Source-order walkthrough

### 1. Schemas and metadata (1–62)

Each job carries ID, cron, humanSchedule, prompt, optional recurring and durable. Enablement and prompt gates match the family. There is no custom validator or classifier.

### 2. Scope and projection (63–79)

Read the combined store. A teammate sees only exact agentId matches; a leader sees all. Convert cron to human text. Emit recurring only when true and durable only when false, preserving the convention that omitted durability denotes the persisted form. The full prompt remains in structured data.

### 3. Mapper and UI (80–98)

Each model-facing row shows schedule, recurring/one-shot, session-only marker when false, and a prompt truncated to 80 characters. Empty output is ordinary `No scheduled jobs.` text. UI adapters consume the structured summaries.

## End-to-end sequence

```mermaid
sequenceDiagram
    participant Q as Parent query
    participant E as Tool executor
    participant T as CronListTool
    participant D as Session and durable cron stores
    Q->>E: tool_use(name, input, id)
    E->>E: Parse input, validate, run hooks and authorization
    alt Execution permitted
        E->>T: call(approved input, context)
        T->>D: listAllCronTasks()
        D-->>T: Durable and session jobs
        T->>T: Filter by teammate agentId if present
        T->>T: Project human schedule and sparse flags
        T->>T: Return jobs, truncate prompts only in mapper
        alt Call and result processing complete normally
            T-->>E: Structured data and optional side channels
            E->>T: mapToolResultToToolResultBlockParam(data, id)
            T-->>E: Model-facing tool_result
            E-->>Q: Tool result and associated events
        else Call or result processing throws
            E->>E: Failure handling and applicable failure hooks
            E-->>Q: Error result and associated events
        end
    else Validation, hook, or permission prevents execution
        E-->>Q: Rejection/error result, call is skipped
    end
    Note over E,Q: A thrown call or mapper error follows the executor error path.
    Q->>Q: Incorporate result, continue or terminate the query
```

The success arrows after `call` describe normal completion. An exception skips normal result mapping; see the failure boundaries below. Query continuation remains subject to cancellation and turn/budget limits.

## State, failure, and cancellation boundaries

The result is a registration snapshot and does not prove the scheduler is currently running. A missing recurring field maps to one-shot. Listing performs no job deletion, expiration, or execution itself, and does not pass an abort signal to storage.
