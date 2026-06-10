# ExitPlanModeTool Design

`ExitPlanModeTool` leaves plan mode after the user or team lead accepts the
plan. It is the write-capable counterpart to `EnterPlanModeTool` because it can
persist plan edits before switching permission mode.

## Source Map

| File | Purpose |
|---|---|
| `tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts` | Tool schema, permissions, validation, plan persistence, and mode transition. |
| `tools/ExitPlanModeTool/prompt.ts` | Model-facing exit-plan instructions. |
| `tools/ExitPlanModeTool/UI.tsx` | Approval, rejection, and status rendering. |
| `tools/ExitPlanModeTool/constants.ts` | Tool name constant. |

## Inputs And Output

The public input accepts optional `allowedPrompts` for Bash prompt permissions.
The SDK path can inject `plan` and `planFilePath`. The output records the plan,
whether the caller is a teammate, plan file metadata, Task tool availability,
and whether the call is awaiting leader approval.

## Lifecycle

For normal sessions, the tool validates that the current permission mode is
`plan`, asks the user to approve exiting plan mode, persists any edited plan,
then updates app state and permissions. For teammates that require plan
approval, it sends a `plan_approval_request` through the teammate mailbox and
returns an awaiting-approval result instead of immediately exiting.

## Permission Notes

The tool is deferred but not read-only. Non-teammates require plan mode and user
approval. Teammates follow the team plan-approval protocol.

