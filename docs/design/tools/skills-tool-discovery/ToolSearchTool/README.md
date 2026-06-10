# ToolSearchTool Design

`ToolSearchTool` fetches full schema definitions for deferred tools. It lets the
initial prompt stay smaller while still allowing the model to load tools by name
or capability when needed.

## Source Map

| File | Purpose |
|---|---|
| `tools/ToolSearchTool/ToolSearchTool.ts` | Search schema, deferred-tool filtering, keyword scoring, pending-MCP reporting, and tool-reference results. |
| `tools/ToolSearchTool/prompt.ts` | Deferred-tool rules, prompt text, and formatting helpers. |
| `tools/ToolSearchTool/constants.ts` | Tool name constant. |

## Search Modes

`query` supports `select:A,B,C` for exact selection and free-text keyword
search. Exact selection can return already-loaded tools as a harmless no-op.
Keyword search scores tool-name parts, MCP server/action names, `searchHint`,
and prompt descriptions. `+term` marks a required term.

## Deferred Tool Rules

MCP tools are deferred unless explicitly marked always-load. Regular tools are
deferred when `shouldDefer` is true. `ToolSearch` itself is never deferred, and
some communication or agent tools are kept loaded under feature gates.

## Result Encoding

Matches are returned as `tool_reference` blocks so the model receives complete
schemas. If no matches are found and MCP servers are still connecting, the
result names those pending servers.

