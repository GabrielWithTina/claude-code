# TeamDeleteTool Design

`TeamDeleteTool` cleans up a swarm team's team and task directories after the
team has shut down.

## Source Map

| File | Purpose |
|---|---|
| `tools/TeamDeleteTool/TeamDeleteTool.ts` | Tool schema, active-member guard, directory cleanup, app-state clearing, and telemetry. |
| `tools/TeamDeleteTool/prompt.ts` | Model-facing cleanup guidance. |
| `tools/TeamDeleteTool/UI.tsx` | Tool use and result rendering. |
| `tools/TeamDeleteTool/constants.ts` | Tool name constant. |

## Behavior

The tool has an empty input. It discovers the active team from app state. If a
team file exists, it counts non-lead members whose `isActive` flag is not false.
Cleanup is refused while any such active members remain.

On success it removes team/task directories, unregisters session cleanup, clears
teammate colors, clears leader task-list routing, and removes team context and
queued inbox messages from app state.

