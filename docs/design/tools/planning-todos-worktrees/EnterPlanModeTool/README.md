# EnterPlanModeTool Design

`EnterPlanModeTool` switches the current session into plan mode. In plan mode,
the assistant can gather information and prepare a plan while write-capable
tools remain restricted by the plan-mode permission context.

## Source Map

| File | Purpose |
|---|---|
| `tools/EnterPlanModeTool/EnterPlanModeTool.ts` | Tool definition, enablement, validation, and app-state transition. |
| `tools/EnterPlanModeTool/prompt.ts` | Model-facing guidance for entering plan mode. |
| `tools/EnterPlanModeTool/UI.tsx` | Tool use and result rendering. |
| `tools/EnterPlanModeTool/constants.ts` | Tool name constant. |

## Lifecycle

The tool has an empty input schema. Its `call()` path rejects agent contexts,
invokes the plan-mode transition helper, updates `toolPermissionContext` to
`plan`, and applies the permission update to app state.

The returned message depends on whether the plan-mode interview phase is
enabled. Interview mode emphasizes that the assistant must not write or edit
files except the plan file. The older path returns the general plan-mode
workflow text.

## Enablement And Permissions

The tool is deferred, read-only, and concurrency-safe. It is disabled for
channel modes where entering plan mode would trap the model in a mode it cannot
exit through normal channel flow.

