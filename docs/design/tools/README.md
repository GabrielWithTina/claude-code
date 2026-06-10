# Tool Design Documents

This directory contains subsystem design notes for tool implementations. Tool
documents are grouped into category subdirectories by operational role.

## Delegation, Teams, And Agent Runtime

Directory: [`delegation-teams-agent-runtime/`](./delegation-teams-agent-runtime/)

| Tool | Docs | Covers |
|---|---|---|
| AgentTool | [agenttool/README.md](./delegation-teams-agent-runtime/agenttool/README.md) | Subagent delegation, runner lifecycle, agent definitions, fork/resume, memory, and UI |
| SendMessageTool | [SendMessageTool/README.md](./delegation-teams-agent-runtime/SendMessageTool/README.md) | Team mailbox delivery, broadcast, structured shutdown and plan-approval protocol messages, UDS/bridge peer routing, and safety checks |
| TeamCreateTool | [TeamCreateTool/README.md](./delegation-teams-agent-runtime/TeamCreateTool/README.md) | Swarm team creation, team config files, task-list initialization, app-state team context, and cleanup registration |
| TeamDeleteTool | [TeamDeleteTool/README.md](./delegation-teams-agent-runtime/TeamDeleteTool/README.md) | Active-member guard, team/task directory cleanup, team-context clearing, and task routing reset |

## Shell, REPL, And Internal Execution

Directory: [`shell-repl-internal-execution/`](./shell-repl-internal-execution/)

| Tool | Docs | Covers |
|---|---|---|
| BashTool | [BashTool/README.md](./shell-repl-internal-execution/BashTool/README.md) | Shell command execution: tool definition and call engine, security/injection defense, permission engine, read-only and sandbox classification, path boundaries, sed handling, and UI |
| PowerShellTool | [PowerShellTool/README.md](./shell-repl-internal-execution/PowerShellTool/README.md) | Windows shell execution with file-operation boundaries: prompt guidance, permission pipeline, path validation, read-only classification, sandbox policy, output persistence, and UI |
| REPLTool | [REPLTool/README.md](./shell-repl-internal-execution/REPLTool/README.md) | REPL-mode gates and primitive tool hiding; implementation is partial in this recovered checkout |
| SyntheticOutputTool | [SyntheticOutputTool/README.md](./shell-repl-internal-execution/SyntheticOutputTool/README.md) | Non-interactive structured output, schema-specific synthetic tool creation, AJV validation, and identity caching |
| TungstenTool | [TungstenTool/README.md](./shell-repl-internal-execution/TungstenTool/README.md) | Internal Tungsten stub boundary; no working integration is present in this build |

## Files, Search, And Code Intelligence

Directory: [`files-search-code-intelligence/`](./files-search-code-intelligence/)

| Tool | Docs | Covers |
|---|---|---|
| FileReadTool | [FileReadTool/README.md](./files-search-code-intelligence/FileReadTool/README.md) | Reading text/images/PDFs/notebooks: tool definition, file-type branching call engine, readFileState registration, limits, and image-resize pipeline |
| FileEditTool | [FileEditTool/README.md](./files-search-code-intelligence/FileEditTool/README.md) | In-place string-replacement edits: tool definition, validation and call engine, matching/replacement/patch engine, and diff/rejection UI |
| FileWriteTool | [FileWriteTool/README.md](./files-search-code-intelligence/FileWriteTool/README.md) | Whole-file create and overwrite: tool definition, validation and call engine, create-vs-update handling, shared edit code, and UI |
| NotebookEditTool | [NotebookEditTool/README.md](./files-search-code-intelligence/NotebookEditTool/README.md) | Structured Jupyter notebook edits: cell-id resolution, read-before-edit validation, JSON mutation, output clearing, writeback, and UI |
| GlobTool | [GlobTool/README.md](./files-search-code-intelligence/GlobTool/README.md) | File-name pattern matching via `ripgrep --files`: schema, lifecycle, call engine, mtime sorting/truncation, and Glob-vs-Grep guidance |
| GrepTool | [GrepTool/README.md](./files-search-code-intelligence/GrepTool/README.md) | Content search via ripgrep: schema, arg-building/result-parsing pipeline, output modes, and result UI |
| LSPTool | [LSPTool/README.md](./files-search-code-intelligence/LSPTool/README.md) | Read-only file-based code intelligence: operation schema, file validation, server requests, gitignored-result filtering, formatting, and UI summaries |

## Planning, Todos, And Worktrees

Directory: [`planning-todos-worktrees/`](./planning-todos-worktrees/)

| Tool | Docs | Covers |
|---|---|---|
| AskUserQuestionTool | [askuserquestiontool/README.md](./planning-todos-worktrees/askuserquestiontool/README.md) | Interactive multiple-choice prompting: schemas, lifecycle flags, preview feature, validation, result mapping, and UI |
| EnterPlanModeTool | [EnterPlanModeTool/README.md](./planning-todos-worktrees/EnterPlanModeTool/README.md) | Plan-mode transition, permission-context update, agent-context rejection, interview-mode result text, and channel-mode disablement |
| ExitPlanModeTool | [ExitPlanModeTool/README.md](./planning-todos-worktrees/ExitPlanModeTool/README.md) | Plan approval, plan-file persistence, allowed prompt handling, teammate approval routing, and permission-mode transition |
| TodoWriteTool | [TodoWriteTool/README.md](./planning-todos-worktrees/TodoWriteTool/README.md) | Legacy todo state, TodoV2 disablement, per-agent/session todo keys, clear-on-complete behavior, and verification nudges |
| Task tools | [tasktools/README.md](./planning-todos-worktrees/tasktools/README.md) | TodoV2 task-list tools, file-backed task storage, background task output, and task stopping |
| EnterWorktreeTool | [EnterWorktreeTool/README.md](./planning-todos-worktrees/EnterWorktreeTool/README.md) | Isolated worktree creation, CWD/app-state transition, worktree state persistence, and cache invalidation |
| ExitWorktreeTool | [ExitWorktreeTool/README.md](./planning-todos-worktrees/ExitWorktreeTool/README.md) | Worktree restore, keep/remove actions, destructive removal guard, dirty-worktree checks, and state cleanup |

## MCP

Directory: [`mcp/`](./mcp/)

| Tool | Docs | Covers |
|---|---|---|
| MCPTool | [MCPTool/README.md](./mcp/MCPTool/README.md) | Dynamic MCP server tool wrapper: namespacing, schema forwarding, permissions, progress, elicitation retry, result transformation, output persistence, and UI |
| ListMcpResourcesTool | [ListMcpResourcesTool/README.md](./mcp/ListMcpResourcesTool/README.md) | MCP resource discovery: resource-helper registration, cached per-server fetches, list-changed freshness, result mapping, and UI |
| ReadMcpResourceTool | [ReadMcpResourceTool/README.md](./mcp/ReadMcpResourceTool/README.md) | MCP resource reading: server/URI validation, resources/read requests, binary blob persistence, result mapping, and UI |
| McpAuthTool | [McpAuthTool/README.md](./mcp/McpAuthTool/README.md) | Authentication pseudo-tool for MCP servers in needs-auth state: OAuth URL generation, unsupported connector handling, background reconnect, and prefix replacement |

## Skills And Tool Discovery

Directory: [`skills-tool-discovery/`](./skills-tool-discovery/)

| Tool | Docs | Covers |
|---|---|---|
| SkillTool | [SkillTool/README.md](./skills-tool-discovery/SkillTool/README.md) | Slash-command skill execution, local/bundled/MCP skill resolution, forked-agent lifecycle, progress streaming, and prompt-budgeting |
| ToolSearchTool | [ToolSearchTool/README.md](./skills-tool-discovery/ToolSearchTool/README.md) | Deferred tool discovery, exact selection, keyword scoring, MCP pending-server reporting, and `tool_reference` result encoding |

## Web, Remote APIs, And User Messaging

Directory: [`web-remote-apis-messaging/`](./web-remote-apis-messaging/)

| Tool | Docs | Covers |
|---|---|---|
| WebFetchTool | [WebFetchTool/README.md](./web-remote-apis-messaging/WebFetchTool/README.md) | URL fetch, domain permissions, redirect handling, markdown conversion, prompt application, cache, and binary persistence |
| WebSearchTool | [WebSearchTool/README.md](./web-remote-apis-messaging/WebSearchTool/README.md) | Server-side web search, domain filters, provider/model enablement, progress extraction, result mapping, and source-reporting prompt |
| RemoteTriggerTool | [RemoteTriggerTool/README.md](./web-remote-apis-messaging/RemoteTriggerTool/README.md) | Claude.ai remote-trigger API routing, OAuth handling, policy/feature gates, and list/get/create/update/run actions |
| BriefTool | [BriefTool/README.md](./web-remote-apis-messaging/BriefTool/README.md) | User-message attachments: path validation, metadata resolution, bridge-mode upload, image detection, and structured attachment output |

## Scheduling And Workflow

Directory: [`scheduling-workflow/`](./scheduling-workflow/)

| Tool | Docs | Covers |
|---|---|---|
| ScheduleCronTool | [ScheduleCronTool/README.md](./scheduling-workflow/ScheduleCronTool/README.md) | `CronCreate`, `CronDelete`, and `CronList`: cron validation, durable/session-only storage, scheduler activation, ownership checks, and listing |
| SleepTool | [SleepTool/README.md](./scheduling-workflow/SleepTool/README.md) | Prompt-only sleep-tool boundary in this recovered checkout; no executable implementation is present under `tools/SleepTool` |
| WorkflowTool | [WorkflowTool/README.md](./scheduling-workflow/WorkflowTool/README.md) | Workflow tool-name stub boundary; workflow-scripts implementation is not present in this build |

## Configuration

Directory: [`configuration/`](./configuration/)

| Tool | Docs | Covers |
|---|---|---|
| ConfigTool | [ConfigTool/README.md](./configuration/ConfigTool/README.md) | Supported setting registry, read/write schema, validation, app-state sync, feature-gated settings, and permission behavior |

Add new tool documentation in the most specific category subdirectory above.
