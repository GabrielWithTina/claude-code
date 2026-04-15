# Claude Code — Design Overview

Claude Code is Anthropic's CLI for Claude: a terminal application that runs as both an interactive REPL and a headless/SDK agent. The UI is built with [Ink](https://github.com/vadimdemedes/ink) (React for terminals). All LLM calls go through the Anthropic SDK.

---

## Module Map

| Path | Role |
|---|---|
| `main.tsx` | Entry point: CLI argument parsing, auth, startup prefetch, REPL/headless dispatch |
| `QueryEngine.ts` | Session lifecycle: owns messages, usage, and permission state across turns |
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
    SDK["Headless / SDK path\n(ask() / QueryEngine)"]

    QE["QueryEngine.ts\n(session state, submitMessage())"]
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
    REPL --> QE
    SDK --> QE
    QE --> QC
    QC --> CTX
    QC --> SP
    QE --> Q
    Q --> API
    Q --> TR
    TR --> TT
    TR --> TD
    Q --> COMPACT
    QE --> MCP
    QE --> COORD
    CLI --> DREAM
```

---

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant REPL as screens/REPL.tsx
    participant QE as QueryEngine
    participant Q as query()
    participant API as Anthropic API
    participant Tools as Tool executor

    User->>REPL: types message
    REPL->>QE: submitMessage(prompt)
    QE->>QE: fetchSystemPromptParts()
    QE->>QE: processUserInput() — slash commands
    QE-->>REPL: yield system_init (tools, model, permissions)
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
    QE-->>REPL: yield result (success / error subtype)
    REPL-->>User: renders response
```

---

## Design Documents

| File | Covers |
|---|---|
| [README.md](./README.md) | Top-level architecture, module map, data-flow sequence |
| [query-engine.md](./query-engine.md) | `QueryEngine` — session lifecycle, `submitMessage()` pipeline, budget control, SDK message types |
| [query-loop.md](./query-loop.md) | `query()` — LLM streaming loop, tool execution, compaction, token budgets, error recovery |
| [context.md](./context.md) | System-prompt assembly, CLAUDE.md loading, git status, cache boundary |
| [tool-system.md](./tool-system.md) | `Tool` interface, `ToolUseContext`, `buildTool()`, registry assembly (`getTools`, `assembleToolPool`) |
| [permissions.md](./permissions.md) | Permission modes, `ToolPermissionContext`, rule sources, `canUseTool` dispatch, protected files |
| [coordinator.md](./coordinator.md) | Multi-agent coordinator mode: coordinator vs worker roles, system prompt injection, agent lifecycle |
| [autodream.md](./autodream.md) | Background memory consolidation: three-gate system, dream agent, consolidation lock |
| [commands.md](./commands.md) | Slash command registry, custom skill commands, dispatch flow |
| [mcp.md](./mcp.md) | MCP server integration: connections, transports, tool wrapping, auth, resource support |
