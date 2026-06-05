# Agent Runner — Subagent Query Execution

**Sources:** `tools/AgentTool/runAgent.ts`, `tools/AgentTool/agentToolUtils.ts`

## Purpose

`runAgent()` is the execution engine for one subagent invocation. It builds an
agent-specific `ToolUseContext`, resolves the agent's system prompt, tools,
permissions, hooks, skills, MCP clients, and transcript recording, then streams
messages from the shared `query()` loop.

`agentToolUtils.ts` holds shared utilities for tool filtering, result
finalization, handoff classification, progress events, and the background agent
lifecycle used by both fresh launches and resumed agents.

## Runner Flow

```mermaid
flowchart TD
    A["runAgent(params)"] --> B["Resolve agentId + model"]
    B --> C["Merge fork context + prompt messages"]
    C --> D["Build or clone Read file-state cache"]
    D --> E["Load user/system context"]
    E --> F["Optionally omit CLAUDE.md / git status for read-only built-ins"]
    F --> G["Create agent getAppState()<br/>permission + effort overrides"]
    G --> H["Resolve tools"]
    H --> I["Build system prompt"]
    I --> J["Create abort controller"]
    J --> K["Execute SubagentStart hooks"]
    K --> L["Register frontmatter hooks"]
    L --> M["Preload frontmatter skills"]
    M --> N["Initialize agent MCP servers"]
    N --> O["createSubagentContext()"]
    O --> P["Record sidechain transcript + metadata"]
    P --> Q["query(messages, systemPrompt, tools, maxTurns)"]
    Q --> R["Yield recordable messages<br/>and append transcript"]
    R --> S["Cleanup MCP, hooks, caches, todos, shell tasks"]
```

## Context Construction

The runner starts from parent context but intentionally mutates several pieces:

- Forked agents receive filtered parent messages plus the fork directive.
- Normal agents start from the task prompt only.
- Async agents get a fresh abort controller; sync agents share the parent's
  controller.
- Async agents normally run as non-interactive sessions; fork agents using
  `useExactTools` inherit the parent's non-interactive and thinking settings.
- `Explore` and `Plan` omit stale `gitStatus`; agents with `omitClaudeMd` can
  omit the `claudeMd` user context under a GrowthBook kill switch.

## Tool Resolution

`resolveAgentTools()` applies the same policy for the runner and other
consumers:

```mermaid
flowchart TD
    A["availableTools"] --> B{"main thread?"}
    B -- Yes --> C["Skip subagent disallow filters"]
    B -- No --> D["filterToolsForAgent()"]
    D --> E["Drop globally disallowed tools"]
    E --> F["Drop custom-only disallowed tools"]
    F --> G{"async agent?"}
    G -- Yes --> H["Keep only async-safe tools<br/>plus teammate exceptions"]
    G -- No --> I["Keep sync-safe pool"]
    C --> J["Apply agent disallowedTools"]
    H --> J
    I --> J
    J --> K{"tools undefined or ['*']?"}
    K -- Yes --> L["All filtered tools"]
    K -- No --> M["Resolve named tool specs"]
    M --> N["Extract Agent(type list)<br/>as allowedAgentTypes"]
```

MCP tools are always allowed by the base filter. `ExitPlanMode` is allowed for
agents whose permission mode is `plan`.

## MCP Servers

Agents can specify `mcpServers` in frontmatter or JSON. `runAgent()` calls
`initializeAgentMcpServers()` to add those connections to the inherited parent
MCP clients.

```mermaid
sequenceDiagram
    participant Runner as runAgent
    participant MCP as initializeAgentMcpServers
    participant Config as MCP config
    participant Client as MCP client

    Runner->>MCP: agentDefinition + parentClients
    alt no agent mcpServers
        MCP-->>Runner: parent clients, no tools, noop cleanup
    else string reference
        MCP->>Config: getMcpConfigByName(name)
        MCP->>Client: connectToServer(name, config)
    else inline definition
        MCP->>Client: connectToServer(dynamic name, config)
        Note over MCP: inline clients are marked for cleanup
    end
    MCP->>Client: fetchToolsForClient()
    MCP-->>Runner: merged clients, agent MCP tools, cleanup()
```

When strict plugin-only MCP customization is active, frontmatter MCP servers are
skipped for user-controlled agents but still allowed for built-in, plugin, and
policy agents.

## Background Lifecycle

`runAsyncAgentLifecycle()` is the shared async driver. It is used for agents
launched in the background from the start, agents backgrounded mid-flight, and
agents resumed from transcript.

```mermaid
flowchart TD
    A["runAsyncAgentLifecycle()"] --> B["Create progress tracker"]
    B --> C["Optionally start summarization<br/>from cache-safe params"]
    C --> D["for await makeStream()"]
    D --> E["Append retained messages to task"]
    E --> F["Update progress + SDK task_progress"]
    F --> D
    D --> G["finalizeAgentTool()"]
    G --> H["completeAsyncAgent()<br/>unblock TaskOutput first"]
    H --> I["Optional handoff classifier"]
    I --> J["Worktree result"]
    J --> K["enqueue completed notification"]
    D -. AbortError .-> L["killAsyncAgent() + partial result notification"]
    D -. Error .-> M["failAsyncAgent() + failed notification"]
```

The status transition happens before handoff classification and worktree cleanup
because both can hang; the task output should unblock as soon as the subagent
has finished.

## Finalization And Safety Review

`finalizeAgentTool()` takes accumulated messages and returns the last assistant
text content, usage, token count, tool-use count, duration, and agent id. If the
final assistant message contains only a tool call, it falls back to the most
recent assistant text block.

When `TRANSCRIPT_CLASSIFIER` is enabled and permission mode is `auto`,
`classifyHandoffIfNeeded()` builds a transcript and runs the YOLO classifier on
the subagent handoff. A blocking classifier result prepends a security warning
to the returned text; classifier unavailability produces a softer verification
warning.

## Cleanup

The runner cleanup path releases:

- agent-specific MCP clients;
- frontmatter session hooks;
- prompt-cache tracking state;
- cloned read-file state and fork context message arrays;
- Perfetto agent registration;
- transcript subdirectory mapping;
- orphaned todo entries;
- shell and monitor tasks owned by the agent.
