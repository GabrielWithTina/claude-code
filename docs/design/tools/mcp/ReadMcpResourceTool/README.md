# ReadMcpResourceTool - MCP Resource Reading

## Module Map

| File | Role |
|---|---|
| `tools/ReadMcpResourceTool/ReadMcpResourceTool.ts` | Tool definition, schema, server validation, `resources/read` request, blob persistence, and result mapping |
| `tools/ReadMcpResourceTool/UI.tsx` | Tool-use and result rendering |
| `tools/ReadMcpResourceTool/prompt.ts` | Description and model-facing prompt |
| `services/mcp/client.ts` | Provides `ensureConnectedClient()` and connects resource-capable servers |
| `utils/mcpOutputStorage.ts` | Persists binary MCP resource blobs to tool-results files |

## Purpose

`ReadMcpResourceTool` reads one resource from one MCP server by server name and
resource URI. It complements `ListMcpResourcesTool`: the model first discovers
available resources, then reads a specific URI from the server that provided it.

The tool is read-only, concurrency-safe, deferred-loadable, and model-facing
under the name `ReadMcpResourceTool`.

## Tool Shape

Input:

| Field | Meaning |
|---|---|
| `server` | Exact MCP server name |
| `uri` | Resource URI to read |

Output:

| Field | Meaning |
|---|---|
| `contents` | Array of resource content entries |
| `contents[].uri` | Content URI |
| `contents[].mimeType` | Optional MIME type |
| `contents[].text` | Text content or saved-binary message |
| `contents[].blobSavedTo` | Optional path where binary content was saved |

## Call Flow

`call()` looks up the server in `ToolUseContext.options.mcpClients`.

Validation at execution time:

1. Missing server name: throw with available server names.
2. Server is not connected: throw.
3. Server does not declare resource support: throw.

For connected resource-capable servers, the tool refreshes the connection with
`ensureConnectedClient()` and sends:

```json
{ "method": "resources/read", "params": { "uri": "<resource-uri>" } }
```

The response is validated with the MCP SDK `ReadResourceResultSchema`.

## Binary Content Handling

Text content is returned directly with URI and MIME type.

For blob content, the tool avoids stringifying base64 into model context:

1. Decode the base64 blob.
2. Generate a unique `mcp-resource-...` persistence id.
3. Save raw bytes through `persistBinaryContent()`.
4. Return `blobSavedTo` plus a short text message describing the saved file,
   MIME type, size, source server, and URI.

If persistence fails, the content entry returns text explaining that the binary
content could not be saved.

The file extension comes from the MIME type in `utils/mcpOutputStorage.ts`,
which maps common document, image, audio, video, and structured text types to
readable extensions and falls back to `.bin`.

## Result Mapping And UI

The model-facing tool result is JSON stringified. The UI shows "(No content)"
when the response has no contents and otherwise renders pretty-printed JSON
through `OutputLine`.

## Sources

- `tools/ReadMcpResourceTool/ReadMcpResourceTool.ts`
- `tools/ReadMcpResourceTool/UI.tsx`
- `tools/ReadMcpResourceTool/prompt.ts`
- `services/mcp/client.ts`
- `utils/mcpOutputStorage.ts`
