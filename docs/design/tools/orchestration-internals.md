# Tool Execution and Orchestration Internals

Primary sources:

- `query.ts:555-568, 826-862, 1360-1515` — query-loop handoff, live collection, final drain, and next-turn construction.
- `services/tools/StreamingToolExecutor.ts:19-530` — streaming scheduler.
- `services/tools/toolOrchestration.ts:1-188` — non-streaming scheduler.
- `services/tools/toolExecution.ts:264-1745` — one invocation's execution pipeline.
- `services/tools/toolHooks.ts:35-650` — hook adaptation and permission resolution.

---

## Purpose and reading model

This is the implementation-level design document for the bridge between a model-emitted Anthropic `tool_use` block and the next model request. It owns neither tool registration nor an individual tool's business operation. The primary pieces under `services/tools/` divide responsibility as follows:

| Module | Primary responsibility |
|---|---|
| `StreamingToolExecutor.ts` | Starts tool invocations while the model response still streams; schedules safe calls concurrently and drains messages incrementally. |
| `toolOrchestration.ts` | Executes a completed response's calls when live streaming execution is disabled. |
| `toolExecution.ts` | Turns one `tool_use` into progress, hooks, authorization, a `Tool.call()` attempt, and model-facing terminal results. |
| `toolHooks.ts` | Adapts hook protocols and reconciles pre-hook decisions with central authorization and configured rules. |

The [shared invocation lifecycle](./invocation-lifecycle.md) describes the common contract used by individual tool documents. This document follows source order and state owned by the bridge itself. It complements [query-loop internals](../query-loop-internals.md), which owns the surrounding model-loop state machine.

“Tool completion” here means that this layer has emitted a terminal `tool_result` for a tool-use ID. It does **not** prove that a remote operation committed, persisted durably, or can be rolled back.

---

## Caller boundary and contracts

`queryLoop()` is the main caller. It creates the streaming executor once per API attempt when its runtime gate is enabled (`query.ts:561-568`), adds every tool block when its containing assistant message arrives (`query.ts:826-845`), and polls already-completed work after every streamed message (`query.ts:847-862`). Once the response ends, it drains the streaming executor or invokes `runTools()` for the non-streaming path (`query.ts:1380-1409`).

The direct command-processing path in `utils/queryHelpers.ts` also calls fallback `runTools()`; it does not require the complete query loop. `runToolUse()` is lower level and is called by the schedulers in this subsystem.

~~~text
Anthropic response stream
  -> queryLoop extracts ToolUseBlock + owning AssistantMessage
  -> StreamingToolExecutor.addTool()             (streaming mode)
     or queryLoop accumulates blocks
  -> runTools()                                  (non-streaming mode)
  -> runToolUse()
  -> checkPermissionsAndCallTool()
  -> Tool.call()
  -> MessageUpdateLazy messages
  -> scheduler MessageUpdate { message?, newContext }
  -> queryLoop yields, normalizes, and appends model-facing user results
  -> next API request, unless a terminal condition ends the turn
~~~

The raw Tool interface is promise-based:

~~~ts
tool.call(input, context, canUseTool, assistantMessage, onProgress?)
  : Promise<ToolResult>
~~~

`runToolUse()` converts that one-final-value contract into an async generator. It can yield progress messages, hook attachments, a structured-output attachment, a user `tool_result`, tool-supplied messages, and a context-modifier envelope. Those yields are protocol events, not a state-machine state.

~~~ts
type MessageUpdateLazy = {
  message: Message
  contextModifier?: {
    toolUseID: string
    modifyContext: (context: ToolUseContext) => ToolUseContext
  }
}

type MessageUpdate = {
  message?: Message
  newContext: ToolUseContext
}
~~~

Progress is normally visible to the UI/SDK but does not become a next-request user message. A final user `tool_result` does; attachments may also be normalized by the parent query.

## End-to-end sequence: model tool use to next model turn

The primary execution path is streaming. The diagram expands one known,
not-already-aborted invocation through every execution boundary. Each permitted
concurrent tool has its own `collectResults()` task, `runToolUse()` generator,
and `Stream`. The alternate scheduler branch shows where non-streaming execution
enters the same pipeline.

~~~mermaid
sequenceDiagram
    participant M as Anthropic model stream
    participant Q as queryLoop
    participant S as StreamingToolExecutor or runTools
    participant E as executeTool
    participant C as collectResults / fallback consumer
    participant R as runToolUse
    participant A as streamedCheckPermissionsAndCallTool
    participant B as Stream queue
    participant X as checkPermissionsAndCallTool
    participant H as hooks and canUseTool
    participant T as Tool.call implementation

    M-->>Q: assistant message with tool_use(id, name, input)
    Q->>Q: retain assistant message and tool block
    alt streamingToolExecution enabled
        Q->>S: addTool(block, owning assistant message)
        S->>S: classify input, enqueue, void processQueue()
        S->>E: await executeTool(tool) when canExecuteTool permits
        E->>E: mark executing and register in-progress ID
        E->>C: start collectResults() without awaiting completion
        C->>C: check abort reason and create per-tool child controller
        E->>E: store collectResults promise as tool.promise
        E-->>S: setup complete, not tool completion
        Note over S,C: processQueue can start other safe tools while collectResults runs
    else streamingToolExecution disabled
        M-->>Q: response stream ends
        Q->>S: runTools(all blocks, assistant messages, context)
        S->>S: partition safe runs and exclusive runs
        S->>C: runToolsSerially() or runToolsConcurrently() via all()
    end
    C->>R: create runToolUse(...) generator and consume with for await
    R->>R: resolve definition and check initial abort
    R->>A: streamedCheckPermissionsAndCallTool(...)
    A->>B: new Stream()
    A->>X: start checkPermissionsAndCallTool(..., onToolProgress)
    A-->>R: return Stream immediately, without awaiting pipeline
    R->>B: for await requests next update
    Note over B,X: A pending Stream.next waits while the producer pipeline runs independently
    X->>X: inputSchema.safeParse() and optional validateInput()
    alt input invalid
        X-->>A: resolve array containing validation-error result
    else input valid
        X->>H: runPreToolUseHooks()
        H-->>X: hook events, input changes, decision or stop
        opt pre-hook progress
            X->>A: onToolProgress(progress)
            A->>B: enqueue(createProgressMessage(...))
            B-->>R: next() resolves with progress
            R-->>C: yield MessageUpdateLazy
        end
        opt pre-hooks did not stop execution
            X->>H: resolveHookPermissionDecision()
            H->>H: check rules and/or await canUseTool as required
            H-->>X: permission decision and effective input
        end
        alt pre-hook stopped or permission not allowed
            X-->>A: resolve stop/denial result and accumulated attachments
        else allowed
            X->>T: await tool.call(input, context, canUseTool, assistant, onProgress)
            loop zero or more tool progress callbacks
                T->>X: onProgress(progress)
                X->>A: onToolProgress(progress)
                A->>B: enqueue(createProgressMessage(...))
                B-->>R: next() resolves with progress
                R-->>C: yield MessageUpdateLazy
            end
            alt call and result processing succeed
                T-->>X: resolve ToolResult with data and optional side channels
                X->>X: map result and prepare attachments/modifier
                X->>H: runPostToolUseHooks()
                H-->>X: hook messages and optional updated MCP output
                X->>X: finish result processing and append newMessages
                X-->>A: resolve MessageUpdateLazy[]
            else call or result processing throws
                X->>H: runPostToolUseFailureHooks(error)
                H-->>X: failure-hook messages
                X-->>A: resolve error tool_result plus failure-hook messages
            end
        end
    end
    A->>B: then: enqueue each resolved update in array order
    A->>B: finally: done()
    loop consume remaining buffered updates
        B-->>R: next() resolves with result or attachment
        R-->>C: yield MessageUpdateLazy
    end
    B-->>R: next() resolves with done=true after queue drains
    R-->>C: generator completes
    alt streaming scheduler
        Note over Q,C: During consumption, collectResults queues progress immediately and buffers other messages
        Note over Q,S: queryLoop polls getCompletedResults during model streaming, overlapping the pipeline above
        C->>C: store results, mark completed, apply exclusive context modifiers
        C-->>S: tool.promise settles
        S->>S: promise.finally triggers another processQueue()
        M-->>Q: response stream ends, possibly before tool completion
        Q->>S: getRemainingResults()
        S->>S: drain pending messages, await tool promises or progress as needed
        S-->>Q: remaining messages and current context
    else non-streaming scheduler
        Note over C,S: runTools forwards updates during consumption and applies modifiers at serial/batch boundaries
        S-->>Q: messages and context updates until all generators finish
    end
    Q->>Q: apply context and collect model-facing messages
    alt parent aborted or hook stopped continuation
        Q-->>Q: return terminal reason&#59; do not make next request
    else normal continuation
        Q->>M: next request with resolved results
    end
~~~

The scheduling setup returns before the tool completes: `executeTool()` stores
the Promise from `collectResults()` rather than awaiting it. Likewise,
`streamedCheckPermissionsAndCallTool()` returns the `Stream` while
`checkPermissionsAndCallTool()` is still pending. The arrows after scheduling
expand that independently running pipeline; they do not imply that model
streaming or other safe invocations wait for it.

The streaming collector drains progress through `pendingProgress`; other
messages remain buffered until that invocation completes. In non-streaming
mode, `runToolsSerially()` or `runToolsConcurrently()` consumes `runToolUse()`
directly; it does not call `executeTool()` or `collectResults()`.

Unknown definitions and an already-aborted context can return early from
`runToolUse()` before the stream adapter is created. Unexpected pipeline
rejections outside its normal error-result handling go through the adapter's
`.catch(error => stream.error(error))`; an error observed by `runToolUse()` is
converted by its outer catch into an error result. Normal call/processing
failures shown above instead resolve an array of error-result messages.

The query loop waits for the selected scheduler to finish before constructing its next state. Calls can run concurrently and results can surface incrementally, but a continued model request sees the completed result set for the current batch.

---

## Query-loop handoff and result ownership

At each iteration, `queryLoop()` owns `assistantMessages`, `toolUseBlocks`, `toolResults`, and `needsFollowUp`. An assistant message may hold multiple tool uses. The loop retains that original message, extracts each block, and sets `needsFollowUp`; it does not depend on response `stop_reason` for the decision.

In streaming mode, each block is registered immediately. The executor retains per-tool buffers, while the query loop yields every delivered message and normalizes only user messages into `toolResults`.

| Value | Owner | Purpose |
|---|---|---|
| `TrackedTool.pendingProgress` / `results` | Streaming executor | Per-invocation delivery queues. |
| `assistantMessages` / `toolUseBlocks` | Current query-loop iteration | Originating assistant response and requests. |
| `toolResults` | Current query-loop iteration | Model-facing normalized user results and later attachments. |
| `ToolUseContext` | Caller, with scheduler-applied replacement | Shared tool/session capabilities and state. |

On streaming fallback, `queryLoop()` tombstones partial assistant messages, clears all three iteration collections, calls `discard()` on the old executor, and creates a new executor. That prevents tool results with old `tool_use_id` values from leaking into the fallback response. Discarding is recovery isolation, not parent cancellation: drain methods suppress old work, and old entries handled afterward use a streaming-fallback synthetic error.

After final draining, the query loop checks the parent abort signal before building another request. It returns `aborted_tools` rather than sending a partially resolved batch to the model. A `hook_stopped_continuation` attachment likewise stops at the parent boundary. The executor reports messages; it does not decide the query-loop terminal reason.

---

## Streaming scheduler: `StreamingToolExecutor`

### State and construction (`19-72`)

The constructor stores the active definitions, injected `canUseTool`, and current `ToolUseContext`. It creates `siblingAbortController` as a child of the parent context controller. This is the local shell-sibling cancellation domain: a Bash error can stop sibling subprocesses without directly terminating the parent model turn.

~~~ts
type ToolStatus = 'queued' | 'executing' | 'completed' | 'yielded'

type TrackedTool = {
  id: string
  block: ToolUseBlock
  assistantMessage: AssistantMessage
  status: ToolStatus
  isConcurrencySafe: boolean
  promise?: Promise<void>
  results?: Message[]
  pendingProgress: Message[]
  contextModifiers?: Array<(context: ToolUseContext) => ToolUseContext>
}
~~~

~~~mermaid
stateDiagram-v2
    [*] --> Queued: addTool
    Queued --> Executing: processQueue permits it
    Executing --> Completed: runToolUse generator ends
    Completed --> Yielded: drain buffers and mark complete
    Yielded --> [*]
    [*] --> Completed: unknown tool
    Queued --> Completed: synthetic result on later abort check
~~~

`discarded` is separate from the per-tool status: when set, both drain methods immediately return without exposing old work.

### Registration and concurrency classification (`73-135`)

`addTool(block, assistantMessage)` resolves the name against the supplied tool pool. An unknown name becomes an already-completed entry holding an error `tool_result`; it bypasses hooks, permission, and `call`.

For a known tool, it Zod-parses the input before asking `isConcurrencySafe(parsedInput)`. An invalid input or classifier exception is treated as non-concurrent. This only schedules conservatively; `runToolUse()` later creates the validation outcome.

`canExecuteTool()` permits a queued invocation when no tool is running, or when both the candidate and **all** executing entries are concurrency-safe. The scan preserves registration order. A blocked exclusive entry breaks the scan, so later safe work cannot pass it:

~~~text
A=Read safe, B=Glob safe, C=Edit exclusive, D=Read safe

A and B start together
C waits; D remains behind C
A/B settle -> C starts alone
C settles -> D starts
~~~

`processQueue()` awaits `executeTool()` only until the latter registers a background promise. The actual operation is not awaited. Each promise's `finally` schedules another queue pass when a running invocation settles.

### Invocation, local cancellation, and context (`265-405`)

`executeTool()` marks the entry executing, adds its ID to the shared in-progress set, and updates the optional UI flag that says all running tools are interruptible. It starts `collectResults()` and stores its promise.

Before a real invocation, `collectResults()` calls `getAbortReason()`:

| Condition | Synthetic terminal result |
|---|---|
| Executor discarded | `streaming_fallback` error. |
| Earlier Bash sibling error | `sibling_error` cancellation. |
| Parent abort other than `interrupt` | User-interrupted rejection. |
| Parent reason `interrupt` and tool behavior is `cancel` | User-interrupted rejection. |
| Parent `interrupt` and behavior is `block`, absent, or throws | No executor-side cancellation. |

For a real attempt, the executor gives `runToolUse()` a new controller whose parent is `siblingAbortController`. If this child aborts for a reason other than `sibling_error`, it aborts the parent `ToolUseContext` controller unless discarded. This preserves the permission-dialog path: a per-tool rejection can need the query loop to end the turn rather than merely feed a rejection result back to the model.

While consuming `runToolUse()`:

- Progress enters `pendingProgress` and wakes a blocked final drain.
- Other messages enter that tool's `results` buffer.
- Context modifiers are retained separately.
- Only a terminal error result from `Bash` sets `hasErrored`, records a short description, and aborts the sibling controller with `sibling_error`.

Bash-only cascading is intentional: parallel shell commands commonly form implicit dependency chains, while an unsuccessful Read, WebFetch, or other tool does not cancel independent siblings. The call that emitted the Bash error does not also receive a duplicate synthetic sibling-error result.

When the generator ends, the entry becomes completed. Context modifiers are applied immediately only for non-concurrent calls. Concurrent modifiers are collected but deliberately unsupported, avoiding nondeterministic shared-context mutation.

### Incremental and final drains (`407-510`)

`getCompletedResults()` is synchronous and never waits. It walks registered tools, drains pending progress first, then emits all buffered messages for each completed entry and marks it `yielded`. An executing exclusive entry stops the scan; an executing safe entry does not. Safe final results can therefore surface in completion order rather than original tool-use order.

`getRemainingResults()` is the blocking final drain. Until all entries are yielded, it reprocesses the queue, drains ready messages, and, when nothing is ready, waits for the first running promise or the next progress notification. Its `Promise.race()` wakes one drain iteration; it is not a whole-batch completion signal.

Both drain methods remove an ID from `setInProgressToolUseIDs` only while delivering its terminal buffered results. A tool can have completed internally but remain marked in progress until its result is observed.

---

## Non-streaming scheduler: `runTools()`

`runTools()` starts after `queryLoop()` receives the complete model response. It carries `currentContext`, yields every underlying update, and replaces context only at defined ordering points.

### Partitioning (`toolOrchestration.ts:19-82`)

`partitionToolCalls()` repeats the conservative classification: find the tool in `toolUseContext.options.tools`, Zod-parse input, call `isConcurrencySafe`, and classify missing, invalid, or throwing cases as exclusive. It builds one batch for each consecutive safe run and a single-item batch for each exclusive call, preserving the same ordering barrier as the streaming queue.

For a safe batch, `runToolsConcurrently()` starts one `runToolUse()` generator per block through `all()`, limited by `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` (default 10). `all()` forwards updates as individual generators progress and does not impose request order. Each generator adds its ID to the in-progress set before starting and removes it after its generator ends.

For an exclusive batch, `runToolsSerially()` fully drains one `runToolUse()` generator before starting the next and applies every returned context modifier immediately. Thus the next exclusive call receives the new context.

### Safe context modifiers are delayed

A safe batch must not mutate `currentContext` in timing-dependent completion order. `runTools()` queues modifiers by `toolUseID` while forwarding messages. After the entire batch has finished, it applies them in original block order, then yields one context-only update.

This is the non-streaming counterpart to the streaming executor's deliberate refusal to apply concurrent modifiers live. The scheduler matches a block to its owning assistant message by searching for its tool-use ID; the non-null assertion relies on the caller invariant that every scheduled block came from an input assistant message.

---

## One invocation: `runToolUse()` and `checkPermissionsAndCallTool()`

### Resolve, early stop, and progress bridge (`337-576`)

`runToolUse()` resolves from the active pool first. It has one compatibility fallback to `getAllBaseTools()` only when the requested name is a deprecated alias, not merely an unexposed primary tool. It also derives MCP transport and logging-safe base-URL metadata.

An unknown tool produces a user error result immediately. If the context signal is already aborted, it produces a stopped result using the cancellation/correction message and returns. Neither branch calls a tool.

For ordinary work, `streamedCheckPermissionsAndCallTool()` places promise-returning `checkPermissionsAndCallTool()` behind a `Stream`. The progress callback enqueues `createProgressMessage()` while that promise runs; resolved updates are then enqueued in order and the stream closes. A rejected promise becomes a stream error, which the outer `runToolUse()` catch converts into an error `tool_result`.

### Input, observable input, and pre-hooks (`599-917`)

`checkPermissionsAndCallTool()` follows this order:

1. Zod `safeParse` validates model input. Failure returns an error result before permission or `call`. A deferred tool can add a ToolSearch hint when its schema was not sent.
2. Optional asynchronous `tool.validateInput()` can reject before `call`.
3. Bash starts its speculative allow-classifier check in parallel with subsequent hooks and permission work; this does not approve the command.
4. A model-supplied Bash `_simulatedSedEdit` field is stripped as a defense-in-depth boundary.
5. `backfillObservableInput` receives a shallow clone. Hooks and authorization see derived/legacy fields while `callInput` preserves original model values unless a hook or permission decision intentionally replaces input.
6. `runPreToolUseHooks()` messages, progress, changed input, decision, continuation stop, additional context, and terminal stop are consumed. A terminal stop returns a stopped tool result before central authorization and `call`.

Telemetry and tracing surround these phases but do not alter authorization.

### Authorization and denial (`918-1183`)

`resolveHookPermissionDecision()` returns both the final `PermissionDecision` and its effective input. An allow decision may have `updatedInput`, which becomes `processedInput` before the call.

Every non-allow decision returns a terminal error `tool_result`, with optional decision-provided content blocks such as pasted images. For a feature-gated auto-mode classifier denial, `PermissionDenied` hooks can add a meta message saying the model may retry. No denied branch calls `Tool.call()`.

### Call, mapping, post-hooks, and normal return (`1184-1588`)

Before calling the implementation, the executor reconciles `callInput` and `processedInput`. If the only difference is a backfilled file-path expansion, it restores the model's original path so serialized result strings and transcript/VCR hashes stay stable. An intentional hook or permission replacement does reach the implementation.

~~~ts
await tool.call(
  callInput,
  { ...toolUseContext, toolUseId, userModified },
  canUseTool,
  assistantMessage,
  progress => onToolProgress({ toolUseID: progress.toolUseID, data: progress.data }),
)
~~~

The executor records duration/activity/tracing, turns an optional `structured_output` into a separate attachment, maps `result.data` to a `ToolResultBlockParam`, and applies result-storage processing. A normal returned report may still map to `is_error: true`; that differs from a thrown exception.

For non-MCP tools, the model-facing result is added before `PostToolUse` hooks. For MCP tools, hooks may replace output first and the final result is then mapped. `addToolResult()` can include user approval feedback/content blocks, retains `mcpMeta` only for non-agent contexts, and carries the tool context-modifier envelope.

Post-success hook attachments normally follow the result, followed by tool-supplied `newMessages`. If a pre-hook requested prevention of continuation, `hook_stopped_continuation` follows the successful result; the query loop interprets it after scheduling.

### Exceptions and failure result (`1589-1745`)

An exception from `Tool.call()` or normal-result processing ends the execution span as failure. `McpAuthError` changes the corresponding connected MCP client to `needs-auth`; it does not retry the invocation. The executor formats the error, runs `PostToolUseFailure` hooks, returns an error `tool_result`, and then returns failure-hook messages. Its `finally` always stops `tool_exec` session activity and removes stored permission-decision data.

An error result is a reporting boundary, not a rollback guarantee. A tool can change a local or remote system and then throw while formatting, storing, or reporting its result.

---

## Hook adapter and permission boundary: `toolHooks.ts`

### Pre-hook outcomes (`435-650`)

`runPreToolUseHooks()` calls `executePreToolHooks()` with the tool name/ID, observable input, context, current permission mode, parent signal, prompt callback, and optional use summary. It converts hook-engine results to a tagged protocol:

| Hook outcome | Execution-layer effect |
|---|---|
| Visible hook message | Yield as progress or attachment. |
| Blocking error | Convert to hook `deny`. |
| `preventContinuation` / stop reason | Preserve a parent-level continuation stop while allowing the applicable result path. |
| Permission `allow`, `ask`, or `deny` | Build `PermissionResult` with hook provenance. |
| Updated input without behavior | Replace observable `processedInput`, then use ordinary authorization. |
| Additional contexts | Yield `hook_additional_context` attachment. |
| Abort or adapter error | Yield cancellation/error attachment and terminal `stop`. |

On terminal `stop`, `toolExecution.ts` creates `createToolResultStopMessage()` and returns before central permission or `call`.

### Reconcile hooks with rules and `canUseTool` (`332-433`)

A PreToolUse hook's `allow` does **not** override configured deny or ask rules:

~~~text
hook allow
  -> use updatedInput when present
  -> interaction unsatisfied, or requireCanUseTool?
       -> call canUseTool
  -> otherwise checkRuleBasedPermissions
       -> no rule: accept hook allow
       -> deny rule: deny wins
       -> ask rule: call canUseTool

hook deny
  -> deny directly

no decision or hook ask
  -> call canUseTool; pass hook ask as forceDecision when supplied
~~~

An interactive tool whose hook supplied updated input treats that input as hook-provided interaction on the rule-check path. `requireCanUseTool` explicitly sends even hook approval through the injected callback. The callback is the central authorization/UI boundary and can return `allow`, `deny`, or `ask`, with messages, replacement input, feedback, content blocks, and provenance.

### Post-success and post-failure hooks (`35-320`)

`runPostToolUseHooks()` forwards visible messages, additional context, and blocking-error attachments; recognizes cancelled hooks; and returns `updatedMCPToolOutput` only for MCP tools. A post hook can request prevention of continuation, which the execution layer represents after the successful result.

`runPostToolUseFailureHooks()` invokes the failure event with the formatted execution error and `isInterrupt`. It yields cancellation, blocking-error, additional-context, and hook-execution-error attachments. Adapter errors are logged rather than permitted to erase the primary tool failure result.

---

## Ordering, cancellation, and error invariants

### Delivery ordering

1. Within one normal `runToolUse()`, non-MCP result precedes post-success hook attachments; MCP post-hooks can alter output before its result is created.
2. Streaming progress is delivered as soon as a poll or final-drain wake sees it; it is not held behind final results.
3. Safe calls may expose final results in completion order. An exclusive call is a barrier and serial calls are fully consumed before the next begins.
4. Non-streaming safe modifiers apply after the batch in original block order. Streaming applies modifiers only for exclusive calls.
5. The next model request is built only after the final drain, but parent abort and continuation-stop conditions prevent it.

### Tool-use/result pairing

The intended continuing-turn invariant is:

~~~text
For every tool_use retained for a continuing model turn,
there is one terminal tool_result with the same tool_use_id
before the next API request.
~~~

**The execution layer covers unknown names, validation failure, permission denial, early abort, call exceptions, streaming fallback handling, and Bash sibling cancellation with real or synthetic terminal results. The parent query does not continue a turn after an aborted batch, so it does not send a partially resolved batch back to the model.**

### Cancellation scope

The streaming executor uses three levels of distinct controllers, connected by
event listeners. This allows cancellation of the parent query or of the
executor's tool group without necessarily ending the query.

#### JavaScript abort fundamentals

An `AbortController` broadcasts a cancellation request through its `signal`:

~~~ts
// Illustrative JavaScript; the listener supplies operation-specific cleanup.
const controller = new AbortController()

controller.signal.addEventListener('abort', () => {
  // Stop work or initiate cleanup here.
})

controller.abort('user_cancelled')
~~~

Calling `abort(reason)` sets `signal.aborted` to `true`, stores the reason in
`signal.reason`, and dispatches an `abort` event. It does not automatically stop
a function, cancel an arbitrary Promise, or throw inside a pending `await`.
The operation must observe the signal or pass it to an API that supports
cancellation. Event notification and completion of asynchronous cleanup are
separate steps.

A controller is one-shot: once aborted, it remains aborted. Later calls do not
reset it or replace its first abort reason. A fresh operation that needs a fresh
cancellation lifetime needs a new controller.

#### Controller hierarchy and downward propagation

~~~text
P: original toolUseContext.abortController
   Scope: parent query
   |
   +-- S: executor.siblingAbortController
       Scope: this executor's tool group
       |
       +-- T1: toolAbortController for tool A
       +-- T2: toolAbortController for tool B
       +-- T3: toolAbortController for tool C

Downward propagation: P -> S -> all linked tool controllers
Conditional upward propagation: Ti -> P
~~~

JavaScript does not automatically establish this hierarchy. The repository's
[`createChildAbortController()`](../../../utils/abortController.ts#L68) helper
creates a distinct child, then connects the parent's abort event to
`child.abort(parent.signal.reason)`. If the parent is already aborted, it
immediately aborts the new child instead of installing a listener.

The essential behavior is equivalent to this simplified pseudocode:

~~~ts
function createChildAbortController(parent) {
  const child = new AbortController()

  if (parent.signal.aborted) {
    child.abort(parent.signal.reason)
  } else {
    parent.signal.addEventListener(
      'abort',
      () => child.abort(parent.signal.reason),
      { once: true },
    )
  }

  return child
}
~~~

The actual helper additionally uses weak references and removes the parent
listener when the child aborts (`utils/abortController.ts:80-96`). Its default
contract is one-way: aborting a parent aborts its linked children, but aborting
a child does not itself abort the parent.

The executor constructor establishes `P -> S`
(`StreamingToolExecutor.ts:59-61`):

~~~ts
this.siblingAbortController = createChildAbortController(
  toolUseContext.abortController,
)
~~~

Each invocation that passes the initial abort check establishes its own
`S -> Ti` link (`StreamingToolExecutor.ts:301-303`):

~~~ts
const toolAbortController = createChildAbortController(
  this.siblingAbortController,
)
~~~

Queued calls do not yet have these per-tool controllers. If cancellation has
already occurred when they are scheduled, the initial `getAbortReason()` check
generates a synthetic result instead of starting the invocation
(`StreamingToolExecutor.ts:276-292`).

#### Which controller does the tool receive?

The `runToolUse()` call receives a shallow context copy with its controller
replaced (`StreamingToolExecutor.ts:320-325`):

~~~ts
{ ...this.toolUseContext, abortController: toolAbortController }
~~~

Consequently, the executor's `this.toolUseContext.abortController` still refers
to **P**, while tool A's received context refers to **T1**, tool B's to **T2**,
and so on. The copy does not replace the executor's stored parent controller.
A tool or permission handler using the received context therefore signals or
observes that invocation's child controller.

#### Conditional upward propagation

The extra listener installed at `StreamingToolExecutor.ts:304-318` explicitly
adds a conditional `Ti -> P` connection:

~~~ts
toolAbortController.signal.addEventListener(
  'abort',
  () => {
    if (
      toolAbortController.signal.reason !== 'sibling_error' &&
      !this.toolUseContext.abortController.signal.aborted &&
      !this.discarded
    ) {
      this.toolUseContext.abortController.abort(
        toolAbortController.signal.reason,
      )
    }
  },
  { once: true },
)
~~~

Each guard has a distinct purpose:

- Excluding `sibling_error` keeps the Bash-failure cascade within the tool group.
- Checking the parent prevents repeated upward propagation when cancellation
  originally came from the parent or another child already aborted it.
- Checking `discarded` prevents an abandoned streaming attempt's child from
  escalating cancellation to the parent through this listener.

This listener is an executor policy layered on top of the one-way helper.
It does not mean child controllers inherently propagate abort upward.

#### Three cancellation scenarios

| Trigger | Propagation | Parent query consequence |
|---|---|---|
| User cancels the parent query | `P -> S -> T1, T2, T3`, preserving the reason | Parent is aborted; the query loop's post-tool check exits with `aborted_tools`. |
| A Bash invocation produces an error result | `S.abort('sibling_error') -> T1, T2, T3` | Child listeners exclude this reason, so this cascade does not abort P; the query can process error results and continue. |
| A permission handler aborts one tool's controller with another reason | `T1 -> P -> S -> T2, T3` | Unless discarded or already parent-aborted, the child escalates to parent and ends the turn. |

For the Bash case, the executor first sets `thisToolErrored`, `hasErrored`, and
the failing tool description, then aborts S with `sibling_error`
(`StreamingToolExecutor.ts:354-362`). The failing invocation's controller is
also a child of S, so it receives the signal too. `thisToolErrored` preserves
its original error result instead of adding a duplicate synthetic sibling
error. Other affected calls receive synthetic errors when the executor handles
their updates. A non-Bash error result does not initiate this cascade.

For permission cancellation, the source comments identify the
`PermissionContext.ts` `cancelAndAbort` path as the reason for upward
propagation (`StreamingToolExecutor.ts:294-300`). Aborting T1 must end the query
in those flows; otherwise the rejection could be sent back to the model as a
normal tool result and the turn could continue. This describes a permission
path that explicitly aborts, not every ordinary permission-denial result.

The `interrupt` reason has an additional executor policy:
`getAbortReason()` checks the tool's `interruptBehavior()` before substituting
a user-interrupted result (`StreamingToolExecutor.ts:219-229`). That check does
not alter the controller links: if P is actually aborted, its signal still
propagates downward. The source expects blocking tools to prevent that
submit-interrupt from being fired in the first place.

Cancellation is cooperative. This layer passes signals to hooks and tool contexts, but a subprocess, storage operation, or remote request that ignores its signal can outlive cancellation. Its external outcome remains unknown until its owning dependency reconciles it.

### What this layer does not guarantee

- It does not generically validate every tool output against an output schema.
- It does not make a tool operation atomic or roll it back after an exception.
- It does not persist messages; query/session consumers own transcript and durable-storage behavior.
- It does not give a hook blanket authority over configured rules or required `canUseTool` checks.
- It does not make concurrent context mutation safe; both scheduling paths constrain or defer it.

---

## Retrieval map

| Question | Start here |
|---|---|
| Why did a tool start before the assistant stream ended? | `StreamingToolExecutor.addTool()` and `query.ts:826-862`. |
| Why did result order differ from tool-use order? | `getCompletedResults()` and safe-concurrency rules. |
| Why did a call not reach the implementation? | `checkPermissionsAndCallTool()` validation, pre-hook, and permission branches. |
| Why did hook approval still prompt or deny? | `resolveHookPermissionDecision()` and rule-based override path. |
| Why did only sibling shell work stop after a failure? | `executeTool()` Bash-only sibling-controller behavior. |
| How can an MCP hook alter output? | `runPostToolUseHooks()` plus delayed MCP `addToolResult()`. |
| Which result belongs in the next API request? | Query-loop normalization after scheduler updates, not the scheduler buffer alone. |

Line numbers identify this recovered source snapshot and may drift. Function, type, and field names are the durable retrieval handles for future source inspection.
