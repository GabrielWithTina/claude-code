# TodoWriteTool Design

`TodoWriteTool` is the legacy in-session todo-list writer. It is disabled when
the TodoV2 task tools are enabled.

## Source Map

| File | Purpose |
|---|---|
| `tools/TodoWriteTool/TodoWriteTool.ts` | Tool definition, todo state update, and verification nudge logic. |
| `tools/TodoWriteTool/prompt.ts` | Legacy todo-list usage guidance. |
| `tools/TodoWriteTool/constants.ts` | Tool name constant. |

## Behavior

The input is `{ todos }`, where `todos` is the legacy todo-list schema. The
state key is the active agent ID when present, otherwise the session ID. If all
todos are completed, the app-state todo list is cleared.

The output includes the old list, new list, and whether a verification nudge was
generated.

## Verification Nudge

When the verification-agent feature gates are enabled, the main thread closes
three or more todos, and no todo content mentions verification, the result text
nudges the model to spawn a verification agent.

