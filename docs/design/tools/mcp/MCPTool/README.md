# MCPTool - Dynamic MCP Server Tool Wrapper

## Module Map

| File | Role |
|---|---|
| `tools/MCPTool/MCPTool.ts` | Base tool template shared by concrete MCP server tools |
| `tools/MCPTool/UI.tsx` | MCP input, progress, and result rendering |
| `tools/MCPTool/classifyForCollapse.ts` | Heuristics for search/read-style MCP tool result collapsing |
| `tools/MCPTool/prompt.ts` | Empty base prompt module; concrete descriptions come from MCP servers |
| `services/mcp/client.ts` | Fetches MCP tool definitions, wraps them as `MCPTool`, calls servers, retries session recovery, and transforms results |
| `services/mcp/mcpStringUtils.ts` | MCP tool name construction and parsing |
| `utils/mcpValidation.ts` | MCP result token estimation and truncation |
| `utils/mcpOutputStorage.ts` | Large MCP output and binary blob persistence helpers |

## Purpose

`MCPTool` is not usually exposed as the literal tool named `mcp`. It is a
template copied and overridden for every tool returned by a connected MCP
server. The concrete tool gets the server-provided name, description, input
schema, annotations, permissions, call implementation, and display name.

Concrete MCP tools are named:

```text
mcp__{normalizedServerName}__{normalizedToolName}
```

For SDK MCP servers, `CLAUDE_AGENT_SDK_MCP_NO_PREFIX` can expose the bare tool
name while preserving `mcpInfo` for permission matching.

## Tool Construction

`fetchToolsForClient()` requests `tools/list`, sanitizes returned tool metadata,
and maps each server tool onto the `MCPTool` template.

Important mapped fields:

| Field | Source |
|---|---|
| `name` | `buildMcpToolName(client.name, tool.name)`, unless SDK no-prefix mode is active |
| `mcpInfo` | Original `{ serverName, toolName }` for permissions and cleanup |
| `description()` | Server-provided tool description |
| `prompt()` | Description capped at `MAX_MCP_DESCRIPTION_LENGTH` |
| `inputJSONSchema` | Server-provided JSON Schema |
| `searchHint` | `_meta["anthropic/searchHint"]`, whitespace-collapsed |
| `alwaysLoad` | `_meta["anthropic/alwaysLoad"] === true` |
| `isReadOnly()` / `isConcurrencySafe()` | `annotations.readOnlyHint` |
| `isDestructive()` | `annotations.destructiveHint` |
| `isOpenWorld()` | `annotations.openWorldHint` |

The concrete `userFacingName()` is `"{server} - {title-or-tool-name} (MCP)"`.

## Permissions

Each MCP tool returns a `passthrough` permission result so the general
permission system decides whether to allow, ask, or deny. The suggestion added
to the permission prompt is a local allow rule for the fully-qualified
`mcp__server__tool` name.

`mcpInfo` is load-bearing: permission matching uses the fully-qualified MCP
name even when no-prefix SDK mode exposes a bare model-facing tool name. This
prevents built-in deny rules from accidentally matching unrelated unprefixed
MCP replacements.

## Call Flow

The concrete `call()` implementation:

1. Extracts the tool use id from the parent message.
2. Sends it to the MCP server as `_meta["claudecode/toolUseId"]`.
3. Emits `mcp_progress` status events for start, server progress, completion,
   and failure.
4. Reconnects through `ensureConnectedClient()`.
5. Calls `callMCPToolWithUrlElicitationRetry()`.
6. Retries once when the session expired and the connection cache was cleared.
7. Returns transformed content plus optional MCP `_meta` and
   `structuredContent` for SDK consumers.

`callMCPTool()` wraps `client.callTool()` with an explicit timeout. It converts
MCP error results into typed errors, maps 401s into `McpAuthError`, and logs
long-running calls every 30 seconds.

## Elicitation Retry

When an MCP tool returns JSON-RPC error `UrlElicitationRequired`, the wrapper
validates URL-mode elicitations, runs elicitation hooks, and either delegates to
the structured I/O handler in print/SDK mode or queues an REPL dialog. Accepted
URL elicitations retry the original tool call. Declined or cancelled
elicitations return a normal tool result explaining that the tool could not
complete.

The retry loop is capped at three URL elicitation attempts.

## Result Transformation

`processMCPResult()` normalizes MCP SDK results into one of three shapes:

| Result source | Model-facing content |
|---|---|
| `toolResult` | Plain string |
| `structuredContent` | JSON string plus compact inferred schema |
| `content[]` | Text/image blocks after per-block transformation |

Content block handling:

- `text` blocks pass through as text.
- `image` blocks are resized and compressed before becoming image blocks.
- `audio` and non-image binary resource blobs are decoded and persisted to the
  tool-results directory, then replaced by a text pointer to the saved file.
- `resource` blocks include source labels such as server and URI.
- `resource_link` blocks become short text references.

Large non-image output is saved to a tool-results file when
`ENABLE_MCP_LARGE_OUTPUT_FILES` permits it. The returned message tells the
model where the output was saved and that it must read chunks before
summarizing. When persistence is disabled, fails, or content contains images,
the tool falls back to token-aware truncation.

## UI

`MCPTool/UI.tsx` keeps non-verbose input headers compact by truncating long
input values when rich output is enabled. Progress renders either a generic
running state, a progress bar when total work is known, or a progress message.

Result rendering warns when the estimated response exceeds 10,000 tokens. Rich
text output tries three display strategies:

1. unwrap a dominant text field from small JSON objects,
2. render small flat JSON objects as aligned `key: value` rows,
3. fall back to `OutputLine`.

A special Slack send-message compact renderer recognizes common Slack MCP
response shapes and shows a single "Sent a message to #channel" line.

## Sources

- `tools/MCPTool/MCPTool.ts`
- `tools/MCPTool/UI.tsx`
- `tools/MCPTool/classifyForCollapse.ts`
- `services/mcp/client.ts`
- `services/mcp/mcpStringUtils.ts`
- `utils/mcpValidation.ts`
- `utils/mcpOutputStorage.ts`
