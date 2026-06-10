# WebFetchTool Design

`WebFetchTool` fetches a URL, converts content to markdown when possible, and
applies a prompt to the fetched content.

## Source Map

| File | Purpose |
|---|---|
| `tools/WebFetchTool/WebFetchTool.ts` | Tool schema, URL validation, permission rules, redirect handling, fetch execution, and result mapping. |
| `tools/WebFetchTool/prompt.ts` | Usage guidance and secondary-model prompt construction. |
| `tools/WebFetchTool/utils.ts` | URL fetch, markdown conversion, cache, binary persistence, and prompt application helpers. |
| `tools/WebFetchTool/preapproved.ts` | Host/path preapproval rules. |
| `tools/WebFetchTool/UI.tsx` | Fetch progress and result rendering. |

## Permission Model

The tool is read-only and concurrency-safe, but host access is permissioned.
Permission rules are keyed as `domain:{hostname}`. Preapproved hosts bypass the
normal ask flow. Deny, ask, and allow rules are checked against the current
tool-permission context.

## Fetch Lifecycle

The input URL is validated with `new URL()`. HTTP URLs may be upgraded by the
fetch utilities. If the response redirects to another host, the tool returns a
redirect instruction instead of silently following it. Fetched HTML is converted
to markdown; large or non-preapproved content is summarized through a smaller
model using the supplied prompt.

## Binary Content

Binary responses can be persisted to disk with a MIME-derived extension. The
result appends the saved path so the assistant can inspect the raw file if the
summary is insufficient.

