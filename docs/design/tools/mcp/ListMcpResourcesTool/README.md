# ListMcpResourcesTool - MCP Resource Discovery

## Module Map

| File | Role |
|---|---|
| `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts` | Tool definition, schema, cached resource fetch, and result mapping |
| `tools/ListMcpResourcesTool/UI.tsx` | Tool-use and result rendering |
| `tools/ListMcpResourcesTool/prompt.ts` | Tool name, description, and prompt |
| `services/mcp/client.ts` | Adds resource tools when a connected server supports resources; provides `fetchResourcesForClient()` and `ensureConnectedClient()` |
| `services/mcp/useManageMCPConnections.ts` | Refreshes resources on `resources/list_changed` notifications |

## Purpose

`ListMcpResourcesTool` lists resources exposed by connected MCP servers. It is
not a server-specific MCP tool; it is a built-in helper added to the tool pool
when at least one connected MCP server declares resource support.

Each returned resource includes the MCP resource fields plus a `server` field
so the model can pass the right server name to `ReadMcpResourceTool`.

## Tool Shape

Input:

| Field | Meaning |
|---|---|
| `server` | Optional exact MCP server name used to filter results |

Output is an array of:

| Field | Meaning |
|---|---|
| `uri` | Resource URI |
| `name` | Resource name |
| `mimeType` | Optional resource MIME type |
| `description` | Optional resource description |
| `server` | MCP server that provides the resource |

The tool is marked read-only, concurrency-safe, and deferred-loadable.

## Registration Boundary

`services/mcp/client.ts` includes `ListMcpResourcesTool` and
`ReadMcpResourceTool` only when a connected server supports resources. The
connection path adds the resource helper tools once, even if multiple servers
support resources.

The normal built-in registry excludes MCP resource tools from `getTools()` and
adds them through MCP connection state instead. This keeps the tools hidden
unless resources are actually available.

## Call Flow

`call()` reads `mcpClients` from `ToolUseContext.options`.

1. If `server` is provided, filter clients by exact name.
2. If no matching server exists, throw with the available server names.
3. For each connected client, call `ensureConnectedClient()`.
4. Fetch resources with `fetchResourcesForClient()`.
5. If one server fails to reconnect or fetch, log the MCP error and return
   resources from the other servers.
6. Flatten all resource arrays into the tool result.

`fetchResourcesForClient()` is LRU-cached by server name, warmed during startup
prefetch, cleared on close, and invalidated when the server sends
`resources/list_changed`.

## Result Mapping And UI

For the model, an empty list maps to a sentence explaining that no resources
were found and that servers may still provide tools. Non-empty results are
stringified as JSON.

The UI renders a compact "(No resources found)" row for empty results and
pretty-printed JSON through `OutputLine` for non-empty results.

## Sources

- `tools/ListMcpResourcesTool/ListMcpResourcesTool.ts`
- `tools/ListMcpResourcesTool/UI.tsx`
- `tools/ListMcpResourcesTool/prompt.ts`
- `services/mcp/client.ts`
- `services/mcp/useManageMCPConnections.ts`
