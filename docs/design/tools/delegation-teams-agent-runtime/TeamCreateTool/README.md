# TeamCreateTool Design

`TeamCreateTool` creates a swarm team and the matching file-backed task list.

## Source Map

| File | Purpose |
|---|---|
| `tools/TeamCreateTool/TeamCreateTool.ts` | Tool schema, validation, team file creation, task-list initialization, app-state update, and telemetry. |
| `tools/TeamCreateTool/prompt.ts` | Model-facing team workflow and coordination guidance. |
| `tools/TeamCreateTool/UI.tsx` | Tool use rendering. |
| `tools/TeamCreateTool/constants.ts` | Tool name constant. |

## Behavior

The input is `{ team_name, description?, agent_type? }`. The tool rejects an
empty team name and rejects creating a second team from the same leader session.
If the requested team name already exists, it generates a unique word slug.

The call path writes `~/.claude/teams/{team-name}/config.json`, resets and
creates the matching `~/.claude/tasks/{team-name}/` directory, registers session
cleanup, records the leader team name for task routing, and stores the team
context in app state.

## Enablement

The tool is deferred and only enabled when agent swarms are enabled.

