# RemoteTriggerTool Design

`RemoteTriggerTool` manages scheduled remote Claude Code agents through the
claude.ai remote-trigger API.

## Source Map

| File | Purpose |
|---|---|
| `tools/RemoteTriggerTool/RemoteTriggerTool.ts` | Tool schema, feature/policy gate, OAuth handling, API routing, and result mapping. |
| `tools/RemoteTriggerTool/prompt.ts` | Action list and API usage guidance. |
| `tools/RemoteTriggerTool/UI.tsx` | Tool use and result rendering. |

## Actions

The input is `{ action, trigger_id?, body? }`, where `action` is one of `list`,
`get`, `create`, `update`, or `run`. `get`, `update`, and `run` require
`trigger_id`; `create` and `update` require `body`.

## Authentication And API Boundary

The tool refreshes OAuth tokens in process, obtains the organization UUID, and
calls `/v1/code/triggers` with the configured claude.ai API base URL. The OAuth
token is never exposed to shell commands.

## Enablement

The tool is deferred, concurrency-safe, and gated by both a GrowthBook feature
and the `allow_remote_sessions` policy. `list` and `get` are read-only; create,
update, and run are not.

