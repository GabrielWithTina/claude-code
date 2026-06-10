# McpAuthTool - Authentication Pseudo-Tool

## Module Map

| File | Role |
|---|---|
| `tools/McpAuthTool/McpAuthTool.ts` | Factory for per-server authentication pseudo-tools |
| `services/mcp/client.ts` | Creates auth tools for `needs-auth` servers and swaps in real tools after reconnect |
| `services/mcp/auth.ts` | OAuth flow implementation used by the auth pseudo-tool |
| `services/mcp/mcpStringUtils.ts` | Builds the `mcp__server__authenticate` tool name and prefix |
| `services/mcp/useManageMCPConnections.ts` | Prefix-based update path that removes stale per-server tools |

## Purpose

`McpAuthTool` is not a static registry tool. `createMcpAuthTool()` creates a
per-server pseudo-tool when an MCP server is installed but currently needs
authentication. It makes the server visible to the model and lets the model
start the OAuth flow on the user's behalf.

The pseudo-tool name is:

```text
mcp__{normalizedServerName}__authenticate
```

Its `mcpInfo` is `{ serverName, toolName: "authenticate" }`, so normal MCP
permission and cleanup paths treat it as belonging to that server.

## When It Appears

`services/mcp/client.ts` creates the auth pseudo-tool when:

- an HTTP, SSE, or claude.ai proxy server is in cached `needs-auth` state,
- discovery exists but no token is available,
- or connection returns a `needs-auth` MCP server state.

In those states the server's real tools are unavailable, so the auth tool is
inserted as the server's only model-facing tool.

## Tool Shape

The input schema is an empty object.

Output:

| Status | Meaning |
|---|---|
| `auth_url` | OAuth started and either returned a URL or completed silently |
| `unsupported` | The transport or connector requires manual `/mcp` auth |
| `error` | OAuth startup failed |

The model-facing tool result is always `data.message`.

## Permission Model

The pseudo-tool allows itself directly in `checkPermissions()`. This is
intentional: invoking it does not access external tool data or mutate the
workspace. It starts authentication and returns instructions or an auth URL for
the user.

The tool is not concurrency-safe and not read-only, so it does not get grouped
with parallel read-only calls.

## Call Flow

`call()` handles three cases:

1. `claudeai-proxy`: return `unsupported` and tell the user to authenticate
   through `/mcp`, because claude.ai connectors use a separate auth flow.
2. Non-HTTP/SSE transport: return `unsupported`, because programmatic OAuth is
   only implemented for SSE and HTTP servers.
3. HTTP/SSE: start `performMCPOAuthFlow()` with `skipBrowserOpen`, capture the
   authorization URL, and return it to the model.

For HTTP/SSE servers, the OAuth promise continues in the background. Once the
browser callback completes, the continuation:

1. clears the MCP auth cache,
2. reconnects the server with `reconnectMcpServerImpl()`,
3. replaces the old server client in `AppState.mcp.clients`,
4. removes existing tools and commands matching the server prefix,
5. inserts the real tools and commands,
6. updates resources when reconnect returned them.

Because the pseudo-tool shares the same `mcp__server__` prefix as the real
tools, the prefix replacement removes it automatically after successful
reconnect.

## Failure Handling

If OAuth completes without a URL, the returned message says authentication
completed silently. If OAuth startup throws, the returned `error` status tells
the user to run `/mcp` and authenticate manually.

If the background OAuth continuation fails after the URL was returned, the
error is logged through MCP logging; the original tool result remains the auth
URL that was already shown to the model.

## Sources

- `tools/McpAuthTool/McpAuthTool.ts`
- `services/mcp/client.ts`
- `services/mcp/auth.ts`
- `services/mcp/mcpStringUtils.ts`
- `services/mcp/useManageMCPConnections.ts`
