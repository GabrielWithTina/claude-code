# Query Loop Design

## Purpose

`query.ts` implements the lower-level LLM call loop. The exported `query()` function is an async generator that drives a single user turn: it calls the Anthropic API, executes tool calls in parallel, handles context compaction, tracks token budgets, recovers from errors, and yields typed messages to its caller (**QueryEngine**).

`query()` wraps `queryLoop()`, which contains the `while(true)` main loop. The outer wrapper exists solely to fire `notifyCommandLifecycle('completed')` on any consumed slash commands when the loop exits normally.

For a source-order, statement-level walkthrough of the complete
`queryLoop()` implementation, see
[Query Loop Internals](./query-loop-internals.md).

---

## Public Interface

```ts
export type QueryParams = {
  messages: Message[]
  systemPrompt: SystemPrompt
  userContext: { [k: string]: string }
  systemContext: { [k: string]: string }
  canUseTool: CanUseToolFn
  toolUseContext: ToolUseContext
  fallbackModel?: string
  querySource: QuerySource
  maxOutputTokensOverride?: number
  maxTurns?: number
  skipCacheWrite?: boolean
  taskBudget?: { total: number }
  deps?: QueryDeps
}

export async function* query(
  params: QueryParams,
): AsyncGenerator<StreamEvent | RequestStartEvent | Message | TombstoneMessage | ToolUseSummaryMessage, Terminal>
```

The generator yields zero or more `Message | StreamEvent` values and then **returns** a `Terminal` object describing why the loop ended (e.g. `{ reason: 'completed' }`, `{ reason: 'max_turns' }`, `{ reason: 'aborted_tools' }`).

---

## Loop State

All mutable cross-iteration state is bundled in a single `State` object. Continue sites replace the whole struct atomically; this makes every transition point explicit.

| Field | Type | Description |
|---|---|---|
| `messages` | `Message[]` | Full conversation history carried into the next iteration |
| `toolUseContext` | `ToolUseContext` | Tool registry, abort controller, app state accessor |
| `autoCompactTracking` | `AutoCompactTrackingState \| undefined` | Tracks turns since last compact and consecutive failures |
| `maxOutputTokensRecoveryCount` | `number` | Number of max-output-tokens retries consumed (cap: 3) |
| `hasAttemptedReactiveCompact` | `boolean` | Guards against infinite reactive-compact spirals |
| `maxOutputTokensOverride` | `number \| undefined` | Escalated token cap for a single retry iteration |
| `pendingToolUseSummary` | `Promise<...> \| undefined` | Haiku summary of previous turn's tool calls, resolved during streaming |
| `stopHookActive` | `boolean \| undefined` | Whether the previous iteration was driven by a stop-hook blocking error |
| `turnCount` | `number` | Monotonically increasing turn counter for `maxTurns` enforcement |
| `transition` | `Continue \| undefined` | Why this iteration started; `undefined` on the first iteration |

---

## Main Loop Flowchart

```mermaid
flowchart TD
    A([Enter queryLoop]) --> B[yield stream_request_start]
    B --> C[applyToolResultBudget\ntruncate oversized tool results]
    C --> D{HISTORY_SNIP\nenabled?}
    D -- yes --> E[snipCompactIfNeeded]
    D -- no --> F[microcompact\ndedup cached tool results]
    E --> F
    F --> G{CONTEXT_COLLAPSE\nenabled?}
    G -- yes --> H[applyCollapsesIfNeeded]
    G -- no --> I[autocompact check]
    H --> I
    I --> J{Token count\nat blocking limit?}
    J -- yes --> K[yield PROMPT_TOO_LONG\nreturn blocking_limit]
    J -- no --> L[callModel — stream from Anthropic API]
    L --> M{message type?}
    M -- assistant + tool_use --> N[StreamingToolExecutor.addTool\nstart parallel execution]
    M -- assistant, no tool_use --> O[accumulate assistantMessages]
    M -- stream_event --> P[yield event]
    N --> Q[yield completed tool results\nas they finish]
    Q --> M
    O --> R{streaming\ncomplete?}
    R -- more --> M
    R -- done --> S{needsFollowUp?}
    S -- yes: tool calls present --> T[runTools / getRemainingResults\ncollect all tool results]
    T --> U{aborted?}
    U -- yes --> V[yield interruption\nreturn aborted_tools]
    U -- no --> W{maxTurns\nexceeded?}
    W -- yes --> X[yield max_turns_reached attachment\nreturn max_turns]
    W -- no --> Y[build next State\nturnCount++]
    Y --> B
    S -- no: end_turn --> Z[handleStopHooks]
    Z --> AA{stop hook\nresult?}
    AA -- prevented --> AB[return stop_hook_prevented]
    AA -- blocking errors --> AC[append errors to messages\ncontinue with stopHookActive=true]
    AC --> B
    AA -- clean --> AD{TOKEN_BUDGET\ncontinue?}
    AD -- yes --> AE[inject nudge message\ncontinue]
    AE --> B
    AD -- no --> AF([return completed])
```

### API stream events

`stream_event` carries a raw Anthropic streaming event. It originates in the
API layer rather than being synthesized by QueryEngine or a tool. As
`services/api/claude.ts` iterates the API stream, it first updates its local
response assembly state for events such as `message_start`,
`content_block_start`, `content_block_delta`, `content_block_stop`,
`message_delta`, and `message_stop`. It then wraps every raw event and yields it
alongside higher-level internal messages (`services/api/claude.ts:1940-2303`):

```ts
yield {
  type: 'stream_event',
  event: part,
  ...(part.type === 'message_start' ? { ttftMs } : undefined),
}
```

The two output forms serve different purposes. `content_block_stop` produces an
assembled `assistant` message that can enter conversation history, while
`stream_event` preserves the granular transport lifecycle and content deltas.
Consequently, one model response normally produces many `stream_event` values
as well as one or more assembled `assistant` messages. The query loop forwards
both through its generic yield path (`query.ts:700-863`).

QueryEngine consumes stream events even when callers did not request partial
output. It uses `message_start` to initialize current-response usage,
`message_delta` to update usage and capture the final `stop_reason`, and
`message_stop` to accumulate that usage into the session total
(`QueryEngine.ts:788-816`). Only when `includePartialMessages` is enabled does
it re-emit the raw event as an SDK `stream_event`
(`QueryEngine.ts:818-825`). Stream events are transient transport state: they
are not appended to `mutableMessages`, converted into model context, or written
to the persistent session transcript.

---

## Tool Execution Flow

Tool calls arrive as `tool_use` blocks inside an assistant message. Two parallel paths exist:

- **StreamingToolExecutor** (default, `config.gates.streamingToolExecution`): tools begin executing as soon as their `tool_use` block appears in the stream. Results are yielded via `getCompletedResults()` interleaved with the ongoing stream.
- **`runTools()`** (fallback): executes all tools after the stream finishes.

Both paths route every tool through the shared permission-resolution path,
which invokes `canUseTool` when required. Both produce `UserMessage` or
`AttachmentMessage` tool-result objects that are appended to `toolResults` for
the next iteration.

```mermaid
flowchart LR
    A[Stream arrives\ntool_use block] --> B{streamingToolExecution\nenabled?}
    B -- yes --> C[StreamingToolExecutor.addTool]
    C --> D[permission resolution]
    D -- approved --> E[execute tool async]
    D -- denied --> F[synthetic error result]
    E --> G{result\nready?}
    G -- yes --> H[yield result message]
    G -- in-flight --> I[getCompletedResults\non next stream event]
    I --> G
    B -- no --> J[accumulate all tool_use blocks]
    J --> K[stream ends]
    K --> L[runTools — parallel execution]
    L --> D
    H --> M[normalizeMessagesForAPI\nappend to toolResults]
    F --> M
```

When the abort controller fires during tool execution, `StreamingToolExecutor.getRemainingResults()` generates synthetic error results for any in-flight tools so the message history never has an unmatched `tool_use` block.

### `canUseTool`: injected authorization boundary

`canUseTool` is an asynchronous authorization callback, not a boolean flag.
`query()` receives it through `QueryParams`, but does not implement permission
policy itself. This lets the same query loop use an interactive permission UI,
an SDK permission-prompt mechanism, a restricted subagent policy, or a
deterministic test implementation.

```ts
type CanUseToolFn = (
  tool: Tool,
  input: Record<string, unknown>,
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
  toolUseID: string,
  forceDecision?: PermissionDecision,
) => Promise<PermissionDecision>
```

The arguments identify both the requested operation and its execution context:
the tool definition, schema-validated model input, current permission/app
state, originating assistant message, and the `tool_use` ID that will link the
request to its result. The optional `forceDecision` carries a decision already
produced by another mechanism, such as a hook. The decision is a discriminated
union:

| Behavior | Effect |
|---|---|
| `allow` | Execute the tool. `updatedInput`, when present, replaces the input used for execution. |
| `deny` | Do not execute the tool; produce an error `tool_result` containing the denial reason. |
| `ask` | Request an interactive or host-mediated decision. If no mechanism resolves it, it remains non-allowed. |

The callback participates in the following path:

```text
model tool_use
  -> StreamingToolExecutor / runTools()
  -> runToolUse()
  -> run PreToolUse hooks
  -> resolveHookPermissionDecision()
  -> canUseTool(...) when required
  -> allow: tool.call(...)
     deny/ask: error tool_result, without calling the tool
```

`resolveHookPermissionDecision()` combines hook output with normal permission
policy (`services/tools/toolHooks.ts:321-405`). A hook `allow` does not override
explicit settings-based `deny` or `ask` rules. Tools that require user
interaction, and contexts with `requireCanUseTool`, must still pass through
`canUseTool`; otherwise an eligible hook approval can avoid an additional
interactive prompt while remaining subject to rule-based checks.

The concrete callback depends on the caller. Interactive REPL mode constructs
it with `useCanUseTool()`, which evaluates `hasPermissionsToUseTool()` and
routes unresolved `ask` decisions to interactive, coordinator, or swarm-worker
handlers (`hooks/useCanUseTool.tsx:27-180`). Headless mode can use configured
rules directly or delegate `ask` decisions to an SDK/stdio permission prompt
(`cli/print.ts:4145-4263`). QueryEngine wraps the supplied callback to collect
non-allow decisions as `SDKPermissionDenial` records for its final result
(`QueryEngine.ts:243-271`).

After approval, `runToolUse()` passes the same callback into `tool.call()`
(`services/tools/toolExecution.ts:1206-1222`). Composite tools can therefore
apply the same authorization boundary to nested operations rather than
bypassing the caller's permission policy.

### Progress messages

A `progress` message is local tool-execution status, not content emitted by the
model stream. A tool that supports incremental updates calls the `onProgress`
callback passed to `tool.call()`. For example, `BashTool` reports intermediate
output as `bash_progress` while its command generator is still running
(`tools/BashTool/BashTool.tsx:663-677`); `AgentTool` similarly reports nested
assistant/tool activity as `agent_progress`
(`tools/AgentTool/AgentTool.tsx:1110-1123`).

The callback follows this path:

```text
tool.call(..., onProgress)
  -> checkPermissionsAndCallTool() receives the update
  -> streamedCheckPermissionsAndCallTool() wraps it with createProgressMessage()
  -> runToolUse() yields MessageUpdateLazy
  -> runTools() / StreamingToolExecutor forwards the update
  -> query() yields update.message to its caller
```

`createProgressMessage()` adds `type: 'progress'`, a UUID, timestamp, the
progress update's own `toolUseID`, and the enclosing tool call's
`parentToolUseID` (`utils/messages.ts:603-619`). The wrapping callback is in
`services/tools/toolExecution.ts:521-555`; the fallback orchestration path
forwards it through `services/tools/toolOrchestration.ts:19-82`. The final
query-loop emission is the generic `yield update.message` at
`query.ts:1384-1400`, so `query()` does not special-case progress while yielding
tool updates.

Progress is not appended to `toolResults` as model-facing context:
`normalizeMessagesForAPI()` does not turn it into a `user` tool-result message.
It is live UI/SDK state associated with the parent tool call. QueryEngine keeps
it in `mutableMessages` and passes it through SDK normalization; for example,
eligible `bash_progress` and `powershell_progress` updates become throttled
`tool_progress` SDK events (`utils/queryHelpers.ts:120-202`). Persistent session
storage explicitly excludes progress from transcript entries and the
`parentUuid` chain (`utils/sessionStorage.ts:130-155`).

---

## Compaction (overview)

The pre-API segment of each iteration runs four compaction layers in fixed order. Each is documented in detail in [compaction.md](./compaction.md); the loop's view is the ordering, the suppression cascade, and how the 413 fallback wires back into the iteration.

| Order | Layer | Decided by | Suppressed by | Loop entry point |
|---|---|---|---|---|
| 1 | **History Snip** | Model (via `SnipTool`) | `feature('HISTORY_SNIP')` off | `snipModule.snipCompactIfNeeded()` at `query.ts:403` — returns `tokensFreed` plumbed into the autocompact threshold check |
| 2 | **Microcompact** | System (time gap or tool-count) | n/a | `microcompactMessages()` — time-based clears content in-place; cached MC queues `pendingCacheEdits` for the next API call |
| 3 | **Context Collapse** | System (token ladder) | `feature('CONTEXT_COLLAPSE')` off | `applyCollapsesIfNeeded()` — projection layer; commits at ~90%, blocking spawn at ~95% |
| 4 | **Auto-Compact / Session Memory** | System (~93% threshold) | Collapse-active, reactive-only mode, recursion guards | `autoCompactIfNeeded()` — tries `trySessionMemoryCompaction` first, then `compactConversation` |

When auto-compact fires, the loop replaces `messagesForQuery` with `buildPostCompactMessages(compactionResult)` and continues the same iteration with the compacted context — there is no extra loop pass.

### 413 recovery path

If the API returns `prompt_too_long` (a 413), the error is **withheld** from the streaming output so the loop can recover transparently:

```mermaid
flowchart TD
    A[API 413 prompt_too_long] --> B{CONTEXT_COLLAPSE has\nstaged spans to drain?}
    B -- yes --> C[contextCollapse.recoverFromOverflow]
    C --> D[continue with\ntransition=collapse_drain_retry]
    B -- no --> E{reactiveCompact enabled?}
    E -- yes --> F[reactiveCompact.tryReactiveCompact\nsame summary path as proactive]
    F --> G[continue with\ntransition=reactive_compact_retry]
    E -- no --> H[surface withheld error\nreturn prompt_too_long]
```

Withholding is gated by `reactiveCompact.isWithheldPromptTooLong()` and the analogous collapse predicate — see `query.ts:799-823` for the streaming-side suppression and `query.ts:1065-1170` for the recovery dispatch.

### Cross-layer suppression

Three layer interactions are load-bearing and easy to overlook:

- **Snip plumbs `tokensFreed` forward** — `autoCompact.shouldAutoCompact()` subtracts it from `tokenCountWithEstimation` (`autoCompact.ts:225`) so the system doesn't falsely fire autocompact in the window between snip clearing space and the stale usage counter catching up.
- **Context Collapse owns headroom when active** — `shouldAutoCompact` returns `false` when `isContextCollapseEnabled()` (`autoCompact.ts:215-223`). Collapse's 90%/95% ladder straddles the 93% autocompact threshold and would otherwise race.
- **`marble_origami` and `compact` querySources are forbidden from triggering autocompact** — the recursion guard at `autoCompact.ts:171-183` short-circuits both. Without it, a summarizer agent whose own context overflowed would call `runPostCompactCleanup` and destroy the main thread's module-level state.

See [compaction.md](./compaction.md) for the full strategy comparison matrix, threshold math, post-compact attachment budgets, PTL retry, partial compaction, session-memory experiment, and telemetry fields.

---

## Token Budget Tracking

When the `TOKEN_BUDGET` feature flag is on, a **budget tracker** is created once per `queryLoop` entry and checked after every end-turn (no-tool-call) response.

```
createBudgetTracker() → BudgetTracker { continuationCount, lastDeltaTokens, ... }
```

`checkTokenBudget(tracker, agentId, getCurrentTurnTokenBudget(), getTurnOutputTokens())` returns:

- **`continue`** — token spend is below 90% of the budget target and not diminishing returns. The loop injects a meta user message (`nudgeMessage`) and continues without surfacing the decision to the caller.
- **`stop`** — budget exhausted, diminishing returns detected (delta < 500 tokens for 3+ consecutive continuations), or no active budget. The loop returns `completed`.

The feature is specifically for user-specified token targets (e.g. "+500k") and is independent of the context-window compaction system.

---

## Thinking Rules

The source embeds this comment verbatim — these are hard API constraints:

> **Rule 1.** A message that contains a `thinking` or `redacted_thinking` block must be part of a query whose `max_thinking_length > 0`.
>
> **Rule 2.** A thinking block may not be the last block in a content array.
>
> **Rule 3.** Thinking blocks must be preserved for the duration of an assistant trajectory: a single turn, and if that turn contains a `tool_use` block, also its subsequent `tool_result` and the following assistant message.

Violating these rules produces API errors. When a model fallback is triggered (`FallbackTriggeredError`), `stripSignatureBlocks()` removes protected-thinking blocks from history before retrying with the fallback model, because thinking signatures are model-bound.

---

## Error Recovery

### `max_output_tokens` (response truncated)

The error message is **withheld** from the caller during streaming. After the stream ends, three escalation stages fire in order:

1. **OTK escalation** (`tengu_otk_slot_v1` flag): if `maxOutputTokensOverride` is unset, retry the same request at `ESCALATED_MAX_TOKENS` (64k). Fires at most once per turn.
2. **Multi-turn recovery**: inject a meta user message instructing the model to continue from where it stopped. Up to `MAX_OUTPUT_TOKENS_RECOVERY_LIMIT` (3) retries.
3. **Surface the error**: recovery exhausted — yield the withheld error message and return.

### `FallbackTriggeredError` (model unavailable)

Caught inside the inner `while(attemptWithFallback)` loop. The current model is replaced with `fallbackModel`, orphaned partial messages are tombstoned, the streaming executor is discarded and recreated, and the full request is retried.

### Image / PDF errors (`ImageSizeError`, `ImageResizeError`)

Caught in the outer `try/catch`. A user-facing error message is yielded and the loop returns `image_error`.

---

## Stop Hooks

`handleStopHooks()` (`query/stopHooks.ts`) is called after every clean `end_turn` — that is, when no tool calls were made and no withheld error was detected.

```mermaid
flowchart TD
    A[end_turn, no tool calls] --> B[handleStopHooks]
    B --> C[executeStopHooks\nrun user-configured shell commands]
    C --> D{result?}
    D -- preventContinuation --> E[return stop_hook_prevented]
    D -- blockingErrors --> F[append errors to messages\nset stopHookActive=true\ncontinue loop]
    D -- clean pass --> G{isTeammate?}
    G -- yes --> H[executeTaskCompletedHooks\nexecuteTeammateIdleHooks]
    H --> D
    G -- no --> I[fire-and-forget side effects:\nautoDream, extractMemories,\npromptSuggestion, saveCacheSafeParams]
    I --> J[return clean]
```

When stop hooks inject blocking errors, the loop re-enters with `stopHookActive: true`. This flag is threaded through the next `handleStopHooks` call to prevent double-firing.

---

## Key Source Files

| File | Role |
|---|---|
| `~/git/claude-code/query.ts` | Main loop: `query()`, `queryLoop()`, `State` type |
| `~/git/claude-code/query/stopHooks.ts` | `handleStopHooks()` — stop hook execution and side effects |
| `~/git/claude-code/query/tokenBudget.ts` | `createBudgetTracker()`, `checkTokenBudget()` |
| `~/git/claude-code/query/config.ts` | `buildQueryConfig()` — immutable per-loop config snapshot |
| `~/git/claude-code/services/tools/StreamingToolExecutor.ts` | Parallel streaming tool execution |
| `~/git/claude-code/services/tools/toolOrchestration.ts` | `runTools()` — fallback serial/parallel executor |
| `~/git/claude-code/utils/toolResultStorage.ts` | `applyToolResultBudget()` — per-message size enforcement |
| `~/git/claude-code/docs/design/compaction.md` | Full design for snip / microcompact / context collapse / auto-compact / reactive compact |
