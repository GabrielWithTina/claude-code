# SendMessageTool Design

`SendMessageTool` is the mailbox transport for agent teams and, when enabled,
cross-session peers.

## Source Map

| File | Purpose |
|---|---|
| `tools/SendMessageTool/SendMessageTool.ts` | Input schema, validation, permissions, mailbox writes, protocol messages, and shutdown handling. |
| `tools/SendMessageTool/prompt.ts` | Team-message and cross-session usage guidance. |
| `tools/SendMessageTool/UI.tsx` | Message send/result rendering. |
| `tools/SendMessageTool/constants.ts` | Tool name constant. |

## Message Forms

The input is `{ to, summary?, message }`. `message` can be plain text or one of
the structured protocol messages: `shutdown_request`, `shutdown_response`, or
`plan_approval_response`.

Plain text messages require a `summary` for teammate inbox delivery, except for
UDS cross-session sends. `to: "*"` broadcasts to all teammates except the
sender. Structured messages cannot be broadcast or sent cross-session.

## Routing

The normal path writes a mailbox entry for the target teammate or each broadcast
recipient. The structured paths implement graceful shutdown and team-lead plan
approval. When UDS inbox support is built in, `uds:` and `bridge:` addresses are
also accepted for plain text peer messages.

## Permission Notes

The tool is deferred and enabled only when agent swarms are enabled. Plain text
messages are treated as read-only. Cross-machine `bridge:` sends require an
explicit safety-check approval and cannot be bypassed by permission mode.

