# WebSearchTool Design

`WebSearchTool` performs current web search through the Anthropic server-side
web search tool and returns search hits plus any model commentary.

## Source Map

| File | Purpose |
|---|---|
| `tools/WebSearchTool/WebSearchTool.ts` | Tool schema, provider/model enablement, permission passthrough, streaming search execution, progress extraction, and result mapping. |
| `tools/WebSearchTool/prompt.ts` | Usage guidance, source-section requirement, and current-year query reminder. |
| `tools/WebSearchTool/UI.tsx` | Search progress and result rendering. |

## Inputs

The input is `{ query, allowed_domains?, blocked_domains? }`. `query` must be
at least two characters. Allowed and blocked domains are mutually exclusive.

## Execution Model

The tool constructs a `web_search_20250305` server-tool schema with up to eight
uses, then calls `queryModelWithStreaming()` with that schema. Streaming events
are inspected to emit progress updates as search queries appear. Final content
blocks are converted into a list of search-result hit groups and text entries.

## Enablement And Permissions

The tool is enabled for first-party and Foundry providers, and for supported
Claude 4 models on Vertex. It is read-only and concurrency-safe. Permission
handling returns `passthrough` with an allow-rule suggestion.

