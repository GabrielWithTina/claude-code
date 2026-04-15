# QueryEngine

Source: `QueryEngine.ts`

---

## Purpose

`QueryEngine` owns the query lifecycle and session state for a single conversation. One instance is created per conversation. State — messages, file cache, usage totals, permission denials — persists across `submitMessage()` calls, making multi-turn SDK sessions straightforward.

Both the headless/SDK path (`ask()`) and the REPL use `QueryEngine`. The REPL keeps full history for UI scrollback; the SDK path may GC pre-compaction messages when `snipReplay` fires.

---

## Class Overview

```mermaid
classDiagram
    class QueryEngineConfig {
        +cwd: string
        +tools: Tools
        +commands: Command[]
        +mcpClients: MCPServerConnection[]
        +agents: AgentDefinition[]
        +canUseTool: CanUseToolFn
        +getAppState: () => AppState
        +setAppState: (fn) => void
        +initialMessages?: Message[]
        +readFileCache: FileStateCache
        +customSystemPrompt?: string
        +appendSystemPrompt?: string
        +userSpecifiedModel?: string
        +fallbackModel?: string
        +thinkingConfig?: ThinkingConfig
        +maxTurns?: number
        +maxBudgetUsd?: number
        +taskBudget?: total: number
        +jsonSchema?: Record~string, unknown~
        +handleElicitation?: ElicitationHandler
        +snipReplay?: SnipReplayFn
    }

    class QueryEngine {
        -config: QueryEngineConfig
        -mutableMessages: Message[]
        -abortController: AbortController
        -permissionDenials: SDKPermissionDenial[]
        -totalUsage: NonNullableUsage
        -discoveredSkillNames: Set~string~
        -loadedNestedMemoryPaths: Set~string~
        +submitMessage(prompt, opts?) AsyncGenerator~SDKMessage~
        +interrupt() void
        +getMessages() readonly Message[]
        +getReadFileState() FileStateCache
        +getSessionId() string
        +setModel(model) void
    }

    class ask {
        <<function>>
        +ask(params) AsyncGenerator~SDKMessage~
    }

    QueryEngineConfig --> QueryEngine : injected via constructor
    ask --> QueryEngine : creates and delegates to
```

---

## `submitMessage()` Pipeline

```mermaid
flowchart TD
    A([submitMessage called]) --> B[Clear discoveredSkillNames]
    B --> C["Wrap canUseTool to wrappedCanUseTool<br/>collects SDKPermissionDenial list"]
    C --> D["fetchSystemPromptParts<br/>build systemPrompt"]
    D --> E["processUserInput<br/>parse prompt, run slash commands"]
    E --> F["Push messagesFromUserInput<br/>to mutableMessages"]
    F --> G["Persist transcript<br/>recordTranscript"]
    G --> H["Load skills and plugins<br/>getSlashCommandToolSkills"]
    H --> I["Yield system_init message<br/>tools, model, permissions, skills"]
    I --> J{shouldQuery?}

    J -- No --> K["Yield local slash command output<br/>SDKUserMessageReplay / assistant"]
    K --> L["Yield result success"]
    L --> Z([return])

    J -- Yes --> M["for await message of query<br/>LLM loop"]
    M --> N{message.type}

    N -- assistant --> O["push to mutableMessages<br/>yield normalizeMessage"]
    N -- user --> P["push to mutableMessages<br/>yield normalizeMessage<br/>turnCount++"]
    N -- progress --> Q["push + record transcript<br/>yield normalizeMessage"]
    N -- stream_event --> R["update currentMessageUsage<br/>if includePartialMessages: yield"]
    N -- attachment --> S{attachment.type}
    N -- system --> T{system subtype}
    N -- tool_use_summary --> U["yield tool_use_summary"]

    S -- max_turns_reached --> V["yield result error_max_turns<br/>return"]
    S -- structured_output --> W["capture structuredOutputFromTool"]
    S -- queued_command --> X["yield SDKUserMessageReplay"]

    T -- compact_boundary --> Y1["GC pre-compaction messages<br/>yield compact_boundary"]
    T -- api_error --> Y2["yield api_retry"]
    T -- snip boundary --> Y3["snipReplay callback<br/>GC zombie messages"]

    O --> BudgetCheck
    P --> BudgetCheck
    Q --> BudgetCheck
    R --> BudgetCheck
    W --> BudgetCheck
    U --> BudgetCheck

    BudgetCheck{Budget exceeded?} -- maxBudgetUsd --> EB["yield result error_max_budget_usd<br/>return"]
    BudgetCheck -- maxStructuredOutputRetries --> ES["yield result error_max_structured_output_retries<br/>return"]
    BudgetCheck -- No --> M

    M -- loop ends --> FinalCheck{isResultSuccessful?}
    FinalCheck -- No --> EX[yield result error_during_execution\nreturn]
    FinalCheck -- Yes --> SR[yield result success\nwith textResult, structured_output]
    SR --> Z
```

---

## Budget Control

```mermaid
flowchart LR
    subgraph per-message-check["Per-message check"]
        A["after each SDKMessage yield"] --> B{maxBudgetUsd set?}
        B -- Yes --> C{"getTotalCost >= maxBudgetUsd?"}
        C -- Yes --> D["yield result<br/>subtype: error_max_budget_usd<br/>is_error: true"]
        C -- No --> E["continue loop"]
        B -- No --> E
    end

    subgraph max-turns-check["Max-turns check (inside query.ts)"]
        F["after each tool batch"] --> G{"nextTurnCount > maxTurns?"}
        G -- Yes --> H["yield attachment<br/>type: max_turns_reached"]
        H --> I["QueryEngine receives attachment<br/>yields result<br/>subtype: error_max_turns<br/>is_error: true"]
        G -- No --> J["continue loop"]
    end

    subgraph structured-output-retries["Structured output retries"]
        K["on each user message"] --> L{jsonSchema set?}
        L -- Yes --> M{"callsThisQuery >= maxRetries?"}
        M -- Yes --> N["yield result<br/>subtype: error_max_structured_output_retries"]
        M -- No --> O["continue loop"]
        L -- No --> O
    end
```

---

## Permission Denial Tracking

`wrappedCanUseTool` wraps the caller-supplied `canUseTool` function. Every call whose result is not `allow` appends an `SDKPermissionDenial` record to `this.permissionDenials`. The full list is attached to every `result` message so SDK callers know which tools were blocked during the session.

```
wrappedCanUseTool(tool, input, ctx, assistantMsg, toolUseID, forceDecision)
  → calls canUseTool(...)
  → if result.behavior !== 'allow':
      permissionDenials.push({ tool_name, tool_use_id, tool_input })
  → return result
```

---

## `ask()` — Convenience Wrapper

`ask()` is a one-shot generator that creates a `QueryEngine`, calls `submitMessage()` once, and returns the engine's read-file state to the caller when done.

When the `HISTORY_SNIP` feature flag is compiled in, `ask()` injects a `snipReplay` callback. On each `compact_boundary` system message, this callback invokes `snipCompactIfNeeded()` and replaces `mutableMessages` with the snipped result — bounding memory in long headless sessions without affecting the REPL (which projects its own view via `projectSnippedView`).

```
ask(params):
  engine = new QueryEngine({
    ...params,
    snipReplay: (yieldedMsg, store) => {
      if (!isSnipBoundaryMessage(yieldedMsg)) return undefined
      return snipCompactIfNeeded(store, { force: true })
    }
  })
  yield* engine.submitMessage(prompt, { uuid, isMeta })
  setReadFileCache(engine.getReadFileState())
```

---

## SDKMessage Types

Messages yielded by `submitMessage()`:

| type | subtype | When |
|---|---|---|
| `system` | _(init)_ | Once per `submitMessage()` call; carries tools, model, permissions, skills |
| `user` | — | User message replay (when `replayUserMessages`) |
| `assistant` | — | Each assistant content block |
| `progress` | — | Tool-execution progress events |
| `stream_event` | — | Raw API stream events (only if `includePartialMessages`) |
| `attachment` | — | File snapshots, memory attachments, queued commands |
| `tool_use_summary` | — | Haiku-generated summary of a tool batch |
| `system` | `compact_boundary` | Context-window compaction completed |
| `system` | `api_retry` | Retryable API error; includes attempt/delay metadata |
| `result` | `success` | Turn completed normally |
| `result` | `error_max_turns` | `maxTurns` reached |
| `result` | `error_max_budget_usd` | `maxBudgetUsd` exceeded |
| `result` | `error_max_structured_output_retries` | Structured-output retry limit hit |
| `result` | `error_during_execution` | Unexpected terminal state (includes diagnostic errors[]) |

All `result` messages include: `duration_ms`, `duration_api_ms`, `num_turns`, `stop_reason`, `session_id`, `total_cost_usd`, `usage`, `modelUsage`, `permission_denials`, `fast_mode_state`.
