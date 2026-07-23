# Claude Code — Design Overview

Claude Code is Anthropic's CLI for Claude: a terminal application that runs as both an interactive REPL and a headless/SDK agent. The UI is built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals). All LLM calls go through the Anthropic SDK.

---

## Module Map

| Path | Role |
|---|---|
| `main.tsx` | Entry point: CLI argument parsing, auth, startup prefetch, REPL/headless dispatch |
| `QueryEngine.ts` | Session lifecycle for the **headless/SDK path only**: owns messages, usage, and permission state across turns. Not used in interactive mode. |
| `query.ts` | LLM loop: streaming, tool dispatch, compaction, stop-hooks |
| `context.ts` | User/system context: git status, CLAUDE.md files, memory files |
| `utils/queryContext.ts` | System-prompt assembly: `fetchSystemPromptParts()` for cache-key prefix |
| `constants/prompts.ts` | Core system prompt sections |
| `constants/systemPromptSections.ts` | Cacheable prompt fragments; split at `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` |
| `Tool.ts` | Base types: `Tool`, `Tools`, `ToolUseContext`, `PermissionResult` |
| `tools.ts` | Tool registry: `getTools()` / `getAllBaseTools()`, feature-gated assembly |
| `tools/` | One subdirectory per tool (e.g. `BashTool/`, `FileEditTool/`, `AgentTool/`) |
| `screens/REPL.tsx` | Main interactive terminal screen |
| `hooks/` | ~80 React hooks: input, keybindings, IDE integration, voice, task management |
| `state/AppState.tsx` | Global app state via store pattern |
| `commands.ts` | Slash-command registry; `getSlashCommandToolSkills()` |
| `commands/` | One subdirectory per slash command |
| `services/api/` | Claude API client, rate limiting, logging, usage tracking |
| `services/mcp/` | MCP server management and connections |
| `services/autoDream/` | Background memory-consolidation engine |
| `services/compact/` | Auto-compact, reactive-compact, snip-compact strategies |
| `coordinator/` | Multi-agent coordinator mode (Research → Synthesis → Implementation → Verification) |
| `bridge/` | JWT-authenticated integration with claude.ai |
| `entrypoints/agentSdkTypes.ts` | Public SDK type surface (`SDKMessage`, `SDKResultMessage`, etc.) |

---

## Architecture

```mermaid
flowchart TD
    CLI["CLI / main.tsx\n(arg parsing, auth, startup prefetch)"]
    REPL["screens/REPL.tsx\n(interactive terminal, React/Ink)"]
    SDK["Headless / SDK path\n(cli/print.ts → ask())"]

    QE["QueryEngine.ts\n(session state, submitMessage())\nheadless path only"]
    Q["query.ts\n(LLM loop, streaming, tool dispatch)"]

    CTX["context.ts\n(git status, CLAUDE.md, memory)"]
    QC["utils/queryContext.ts\n(fetchSystemPromptParts)"]
    SP["constants/prompts.ts\n(system prompt sections)"]

    TT["Tool.ts\n(types: Tool, ToolUseContext)"]
    TR["tools.ts\n(registry: getTools / getAllBaseTools)"]
    TD["tools/\n(BashTool, FileEditTool, AgentTool, ...)"]

    API["services/api/\n(Anthropic SDK, rate-limit, logging)"]

    MCP["services/mcp/\n(MCP server connections)"]
    DREAM["services/autoDream/\n(memory consolidation)"]
    COORD["coordinator/\n(multi-agent orchestration)"]
    COMPACT["services/compact/\n(auto / reactive / snip)"]

    CLI --> REPL
    CLI --> SDK
    REPL --> Q
    SDK --> QE
    QE --> Q
    REPL --> QC
    QC --> CTX
    QC --> SP
    Q --> API
    Q --> TR
    TR --> TT
    TR --> TD
    Q --> COMPACT
    REPL --> MCP
    REPL --> COORD
    CLI --> DREAM
```

---

## Data Flow

Two distinct paths share `query.ts` but differ in session management.

### Interactive path (REPL)

```mermaid
sequenceDiagram
    participant User
    participant REPL as screens/REPL.tsx (+ hooks)
    participant Q as query()
    participant API as Anthropic API
    participant Tools as Tool executor

    User->>REPL: types message
    REPL->>REPL: fetchSystemPromptParts() — via queryContext
    REPL->>REPL: process slash commands (React hook layer)
    REPL->>Q: query(messages, systemPrompt, ...)
    Q->>API: callModel() — streaming
    API-->>Q: stream events (assistant blocks)
    Q-->>REPL: yield assistant message
    Q->>Tools: runTools(toolUseBlocks)
    Tools-->>Q: tool results (user messages)
    Q-->>REPL: yield tool result messages
    Q->>API: callModel() — next turn
    API-->>Q: end_turn
    Q-->>REPL: return Terminal
    REPL-->>User: renders response
```

### Headless / SDK path (–p / ask())

```mermaid
sequenceDiagram
    participant Caller as cli/print.ts
    participant QE as QueryEngine
    participant Q as query()
    participant API as Anthropic API
    participant Tools as Tool executor

    Caller->>QE: ask(prompt, options)
    QE->>QE: fetchSystemPromptParts()
    QE->>QE: processUserInput() — slash commands
    QE-->>Caller: yield system_init (tools, model, permissions)
    QE->>Q: query(messages, systemPrompt, ...)
    Q->>API: callModel() — streaming
    API-->>Q: stream events (assistant blocks)
    Q-->>QE: yield assistant message
    Q->>Tools: runTools(toolUseBlocks)
    Tools-->>Q: tool results (user messages)
    Q-->>QE: yield tool result messages
    Q->>API: callModel() — next turn
    API-->>Q: end_turn
    Q-->>QE: return Terminal
    QE-->>Caller: yield result (success / error subtype)
```

---

## Design Documents

| File | Covers |
|---|---|
| [README.md](./README.md) | Top-level architecture, module map, data-flow sequence |
| [main.md](./main.md) | `main.tsx` — CLI entry point, startup sequence, Commander options, interactive vs headless dispatch, special modes, subsystem init |
| [repl.md](./repl.md) | `screens/REPL.tsx` — interactive terminal component, query loop, state model, input handling, permissions, hooks |
| [query-engine.md](./query-engine.md) | `QueryEngine` — session lifecycle, `submitMessage()` pipeline, budget control, SDK message types (headless/SDK path only) |
| [query-loop.md](./query-loop.md) | `query()` — LLM streaming loop, tool execution, compaction, token budgets, error recovery |
| [query-loop-internals.md](./query-loop-internals.md) | Source-order walkthrough of `queryLoop()` state, context preparation, streaming, recovery, tools, transitions, and terminal exits |
| [messages.md](./messages.md) | Internal/UI messages, SDK/bridge messages, Anthropic API message payloads, and conversion boundaries |
| [future-message-layer-poc.md](./future-message-layer-poc.md) | Future POC for a channel-neutral canonical conversation event layer between UI channels, SDK protocol, and LLM API payloads |
| [storage.md](./storage.md) | Storage architecture map across transcripts, memory, config, settings, plugins, MCP, tasks, caches, and artifacts |
| [storage-session.md](./storage-session.md) | Session JSONL storage, transcript fields, metadata entries, subagent files, sidecars, and sample-derived field catalog |
| [storage-session-sample-main.md](./storage-session-sample-main.md) | Visual guide and diagram index for the sample main-agent JSONL transcript |
| [storage-config-settings.md](./storage-config-settings.md) | Global config, settings sources, managed policy, project config, and auth-related storage |
| [storage-extensions-mcp.md](./storage-extensions-mcp.md) | Plugin installation metadata, marketplace registry, plugin data dirs, MCP config, and MCP auth cache |
| [storage-runtime-artifacts.md](./storage-runtime-artifacts.md) | Prompt history, live session registry, TodoV2 tasks, scheduled tasks, task output, stats, policy, and cache files |
| [context.md](./context.md) | System-prompt assembly, CLAUDE.md loading, git status, cache boundary |
| [memory.md](./memory.md) | Memory system: CLAUDE.md instruction memory, auto-memory, team memory, agent memory, session memory, storage and load paths |
| [tool-system.md](./tool-system.md) | `Tool` interface, `ToolUseContext`, `buildTool()`, registry assembly (`getTools`, `assembleToolPool`) |
| [permissions.md](./permissions.md) | Permission modes, `ToolPermissionContext`, rule sources, `canUseTool` dispatch, protected files |
| [coordinator.md](./coordinator.md) | Multi-agent coordinator mode: coordinator vs worker roles, system prompt injection, agent lifecycle |
| [autodream.md](./autodream.md) | Background memory consolidation: enabled precondition + three gates, dream agent, consolidation lock |
| [commands.md](./commands.md) | Slash command registry, custom skill commands, dispatch flow |
| [mcp.md](./mcp.md) | MCP server integration: connections, transports, tool wrapping, auth, resource support |
