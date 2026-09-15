# Tool Internals Coverage Index

Every recovered tool entry has a source-order walkthrough, state/error/cancellation boundaries, and an end-to-end Mermaid sequence. The depth scales with executable behavior: small readers need fewer regions than the agent, shell, or file dispatchers. Instrumentation is grouped with the operation it measures; render-only compiler memoization is grouped by UI branch. Existing subsystem and helper documents remain linked for deeper dependencies.

Scope is the tool entry implementations under `tools/`, plus missing entries explicitly referenced by `tools.ts`. Individual remote MCP tools are created dynamically, so the MCP template/client wrapper and authentication factory document that family rather than inventing a fixed server-tool catalog. Aliases share their implementation document.

See [shared invocation lifecycle](./invocation-lifecycle.md) before reading an individual sequence. Source ranges identify this recovered snapshot and may drift. The documentation describes observed source behavior, including inconsistencies; it does not change runtime code.

## Recovered entries

42 entry files accounted for, including AgentTool, dynamic factories, the unavailable Tungsten stub, and the disabled test fixture.

| Entry | Source | Internals and sequence | Evidence status |
|---|---|---|---|
| AgentTool | [tools/AgentTool/AgentTool.tsx](../../../tools/AgentTool/AgentTool.tsx) | [Design](./delegation-teams-agent-runtime/agenttool/agent-tool-internals.md) | Recovered implementation |
| AskUserQuestionTool | [tools/AskUserQuestionTool/AskUserQuestionTool.tsx](../../../tools/AskUserQuestionTool/AskUserQuestionTool.tsx) | [Design](./planning-todos-worktrees/askuserquestiontool/internals.md) | Recovered implementation |
| BashTool | [tools/BashTool/BashTool.tsx](../../../tools/BashTool/BashTool.tsx) | [Design](./shell-repl-internal-execution/BashTool/internals.md) | Recovered implementation |
| BriefTool | [tools/BriefTool/BriefTool.ts](../../../tools/BriefTool/BriefTool.ts) | [Design](./web-remote-apis-messaging/BriefTool/internals.md) | Recovered implementation |
| ConfigTool | [tools/ConfigTool/ConfigTool.ts](../../../tools/ConfigTool/ConfigTool.ts) | [Design](./configuration/ConfigTool/internals.md) | Recovered implementation |
| CronCreateTool | [tools/ScheduleCronTool/CronCreateTool.ts](../../../tools/ScheduleCronTool/CronCreateTool.ts) | [Design](./scheduling-workflow/ScheduleCronTool/cron-create-internals.md) | Recovered implementation |
| CronDeleteTool | [tools/ScheduleCronTool/CronDeleteTool.ts](../../../tools/ScheduleCronTool/CronDeleteTool.ts) | [Design](./scheduling-workflow/ScheduleCronTool/cron-delete-internals.md) | Recovered implementation |
| CronListTool | [tools/ScheduleCronTool/CronListTool.ts](../../../tools/ScheduleCronTool/CronListTool.ts) | [Design](./scheduling-workflow/ScheduleCronTool/cron-list-internals.md) | Recovered implementation |
| EnterPlanModeTool | [tools/EnterPlanModeTool/EnterPlanModeTool.ts](../../../tools/EnterPlanModeTool/EnterPlanModeTool.ts) | [Design](./planning-todos-worktrees/EnterPlanModeTool/internals.md) | Recovered implementation |
| EnterWorktreeTool | [tools/EnterWorktreeTool/EnterWorktreeTool.ts](../../../tools/EnterWorktreeTool/EnterWorktreeTool.ts) | [Design](./planning-todos-worktrees/EnterWorktreeTool/internals.md) | Recovered implementation |
| ExitPlanModeV2Tool | [tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts](../../../tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts) | [Design](./planning-todos-worktrees/ExitPlanModeTool/internals.md) | Recovered implementation |
| ExitWorktreeTool | [tools/ExitWorktreeTool/ExitWorktreeTool.ts](../../../tools/ExitWorktreeTool/ExitWorktreeTool.ts) | [Design](./planning-todos-worktrees/ExitWorktreeTool/internals.md) | Recovered implementation |
| FileEditTool | [tools/FileEditTool/FileEditTool.ts](../../../tools/FileEditTool/FileEditTool.ts) | [Design](./files-search-code-intelligence/FileEditTool/internals.md) | Recovered implementation |
| FileReadTool | [tools/FileReadTool/FileReadTool.ts](../../../tools/FileReadTool/FileReadTool.ts) | [Design](./files-search-code-intelligence/FileReadTool/internals.md) | Recovered implementation |
| FileWriteTool | [tools/FileWriteTool/FileWriteTool.ts](../../../tools/FileWriteTool/FileWriteTool.ts) | [Design](./files-search-code-intelligence/FileWriteTool/internals.md) | Recovered implementation |
| GlobTool | [tools/GlobTool/GlobTool.ts](../../../tools/GlobTool/GlobTool.ts) | [Design](./files-search-code-intelligence/GlobTool/internals.md) | Recovered implementation |
| GrepTool | [tools/GrepTool/GrepTool.ts](../../../tools/GrepTool/GrepTool.ts) | [Design](./files-search-code-intelligence/GrepTool/internals.md) | Recovered implementation |
| ListMcpResourcesTool | [tools/ListMcpResourcesTool/ListMcpResourcesTool.ts](../../../tools/ListMcpResourcesTool/ListMcpResourcesTool.ts) | [Design](./mcp/ListMcpResourcesTool/internals.md) | Recovered implementation |
| LSPTool | [tools/LSPTool/LSPTool.ts](../../../tools/LSPTool/LSPTool.ts) | [Design](./files-search-code-intelligence/LSPTool/internals.md) | Recovered implementation |
| McpAuthTool | [tools/McpAuthTool/McpAuthTool.ts](../../../tools/McpAuthTool/McpAuthTool.ts) | [Design](./mcp/McpAuthTool/internals.md) | Dynamic authentication factory |
| MCPTool | [tools/MCPTool/MCPTool.ts](../../../tools/MCPTool/MCPTool.ts) | [Design](./mcp/MCPTool/internals.md) | Template plus dynamic client wrapper |
| NotebookEditTool | [tools/NotebookEditTool/NotebookEditTool.ts](../../../tools/NotebookEditTool/NotebookEditTool.ts) | [Design](./files-search-code-intelligence/NotebookEditTool/internals.md) | Recovered implementation |
| PowerShellTool | [tools/PowerShellTool/PowerShellTool.tsx](../../../tools/PowerShellTool/PowerShellTool.tsx) | [Design](./shell-repl-internal-execution/PowerShellTool/internals.md) | Recovered implementation |
| ReadMcpResourceTool | [tools/ReadMcpResourceTool/ReadMcpResourceTool.ts](../../../tools/ReadMcpResourceTool/ReadMcpResourceTool.ts) | [Design](./mcp/ReadMcpResourceTool/internals.md) | Recovered implementation |
| RemoteTriggerTool | [tools/RemoteTriggerTool/RemoteTriggerTool.ts](../../../tools/RemoteTriggerTool/RemoteTriggerTool.ts) | [Design](./web-remote-apis-messaging/RemoteTriggerTool/internals.md) | Recovered implementation |
| SendMessageTool | [tools/SendMessageTool/SendMessageTool.ts](../../../tools/SendMessageTool/SendMessageTool.ts) | [Design](./delegation-teams-agent-runtime/SendMessageTool/internals.md) | Recovered implementation |
| SkillTool | [tools/SkillTool/SkillTool.ts](../../../tools/SkillTool/SkillTool.ts) | [Design](./skills-tool-discovery/SkillTool/internals.md) | Recovered implementation |
| SyntheticOutputTool | [tools/SyntheticOutputTool/SyntheticOutputTool.ts](../../../tools/SyntheticOutputTool/SyntheticOutputTool.ts) | [Design](./shell-repl-internal-execution/SyntheticOutputTool/internals.md) | Base tool plus schema factory |
| TaskCreateTool | [tools/TaskCreateTool/TaskCreateTool.ts](../../../tools/TaskCreateTool/TaskCreateTool.ts) | [Design](./planning-todos-worktrees/tasktools/task-create-internals.md) | Recovered implementation |
| TaskGetTool | [tools/TaskGetTool/TaskGetTool.ts](../../../tools/TaskGetTool/TaskGetTool.ts) | [Design](./planning-todos-worktrees/tasktools/task-get-internals.md) | Recovered implementation |
| TaskListTool | [tools/TaskListTool/TaskListTool.ts](../../../tools/TaskListTool/TaskListTool.ts) | [Design](./planning-todos-worktrees/tasktools/task-list-internals.md) | Recovered implementation |
| TaskOutputTool | [tools/TaskOutputTool/TaskOutputTool.tsx](../../../tools/TaskOutputTool/TaskOutputTool.tsx) | [Design](./planning-todos-worktrees/tasktools/task-output-internals.md) | Recovered implementation |
| TaskStopTool | [tools/TaskStopTool/TaskStopTool.ts](../../../tools/TaskStopTool/TaskStopTool.ts) | [Design](./planning-todos-worktrees/tasktools/task-stop-internals.md) | Recovered implementation |
| TaskUpdateTool | [tools/TaskUpdateTool/TaskUpdateTool.ts](../../../tools/TaskUpdateTool/TaskUpdateTool.ts) | [Design](./planning-todos-worktrees/tasktools/task-update-internals.md) | Recovered implementation |
| TeamCreateTool | [tools/TeamCreateTool/TeamCreateTool.ts](../../../tools/TeamCreateTool/TeamCreateTool.ts) | [Design](./delegation-teams-agent-runtime/TeamCreateTool/internals.md) | Recovered implementation |
| TeamDeleteTool | [tools/TeamDeleteTool/TeamDeleteTool.ts](../../../tools/TeamDeleteTool/TeamDeleteTool.ts) | [Design](./delegation-teams-agent-runtime/TeamDeleteTool/internals.md) | Recovered implementation |
| TestingPermissionTool | [tools/testing/TestingPermissionTool.tsx](../../../tools/testing/TestingPermissionTool.tsx) | [Design](./testing/TestingPermissionTool/internals.md) | Test fixture; disabled literal gate |
| TodoWriteTool | [tools/TodoWriteTool/TodoWriteTool.ts](../../../tools/TodoWriteTool/TodoWriteTool.ts) | [Design](./planning-todos-worktrees/TodoWriteTool/internals.md) | Recovered implementation |
| ToolSearchTool | [tools/ToolSearchTool/ToolSearchTool.ts](../../../tools/ToolSearchTool/ToolSearchTool.ts) | [Design](./skills-tool-discovery/ToolSearchTool/internals.md) | Recovered implementation |
| TungstenTool | [tools/TungstenTool/TungstenTool.ts](../../../tools/TungstenTool/TungstenTool.ts) | [Design](./shell-repl-internal-execution/TungstenTool/internals.md) | Unavailable stub; call throws |
| WebFetchTool | [tools/WebFetchTool/WebFetchTool.ts](../../../tools/WebFetchTool/WebFetchTool.ts) | [Design](./web-remote-apis-messaging/WebFetchTool/internals.md) | Recovered implementation |
| WebSearchTool | [tools/WebSearchTool/WebSearchTool.ts](../../../tools/WebSearchTool/WebSearchTool.ts) | [Design](./web-remote-apis-messaging/WebSearchTool/internals.md) | Recovered implementation |

## Referenced entries absent from this archive

These 15 entries have a separate boundary document and diagram each. Their gate/import boundary is verified; an execution design, schema, or cancellation contract cannot be recovered without the missing implementation. Workflow’s bundled initializer is also absent.

| Entry | Registry gate | Boundary document |
|---|---|---|
| REPLTool | `USER_TYPE === 'ant'` | [Design boundary](./shell-repl-internal-execution/REPLTool/internals.md) |
| SuggestBackgroundPRTool | `USER_TYPE === 'ant'` | [Design boundary](./delegation-teams-agent-runtime/SuggestBackgroundPRTool/internals.md) |
| SleepTool | `PROACTIVE or KAIROS` | [Design boundary](./scheduling-workflow/SleepTool/internals.md) |
| MonitorTool | `MONITOR_TOOL` | [Design boundary](./scheduling-workflow/MonitorTool/internals.md) |
| SendUserFileTool | `KAIROS` | [Design boundary](./web-remote-apis-messaging/SendUserFileTool/internals.md) |
| PushNotificationTool | `KAIROS or KAIROS_PUSH_NOTIFICATION` | [Design boundary](./web-remote-apis-messaging/PushNotificationTool/internals.md) |
| SubscribePRTool | `KAIROS_GITHUB_WEBHOOKS` | [Design boundary](./web-remote-apis-messaging/SubscribePRTool/internals.md) |
| VerifyPlanExecutionTool | `CLAUDE_CODE_VERIFY_PLAN === 'true'` | [Design boundary](./planning-todos-worktrees/VerifyPlanExecutionTool/internals.md) |
| OverflowTestTool | `OVERFLOW_TEST_TOOL` | [Design boundary](./testing/OverflowTestTool/internals.md) |
| CtxInspectTool | `CONTEXT_COLLAPSE` | [Design boundary](./configuration/CtxInspectTool/internals.md) |
| TerminalCaptureTool | `TERMINAL_PANEL` | [Design boundary](./shell-repl-internal-execution/TerminalCaptureTool/internals.md) |
| WebBrowserTool | `WEB_BROWSER_TOOL` | [Design boundary](./web-remote-apis-messaging/WebBrowserTool/internals.md) |
| SnipTool | `HISTORY_SNIP` | [Design boundary](./configuration/SnipTool/internals.md) |
| ListPeersTool | `UDS_INBOX` | [Design boundary](./web-remote-apis-messaging/ListPeersTool/internals.md) |
| WorkflowTool | `WORKFLOW_SCRIPTS` | [Design boundary](./scheduling-workflow/WorkflowTool/internals.md) |

## Reading conventions

- A normal failure report, mapper-set `is_error`, validation rejection, and thrown exception are distinct outcomes.
- A returned background ID, queued message, authentication URL, or schedule registration does not establish completion of later work.
- Sequence participants group closely related dependency helpers when they share one phase; the walkthrough identifies the concrete functions and ownership.
- Schemas and feature flags reflect this checkout. No remote services, credentials, real shell commands, worktrees, or messaging actions were exercised to author these documents.
