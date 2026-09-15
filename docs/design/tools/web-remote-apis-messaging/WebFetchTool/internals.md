# WebFetchTool Internals

Source: [tools/WebFetchTool/WebFetchTool.ts](../../../../../tools/WebFetchTool/WebFetchTool.ts). Line ranges refer to this recovered source snapshot; symbols are the stable navigation handles.

## Purpose and caller boundary

Fetches URL content, then either returns trusted Markdown directly or asks a secondary model to apply the supplied prompt. Strict input requires a URL and prompt. Output includes bytes, HTTP code/text, result, duration, and original URL. Deferred, read-only, and concurrency-safe, it separates host permission from fetch-domain preflight.

The [shared invocation lifecycle](../../invocation-lifecycle.md) explains registry selection, schema validation, authorization, hooks, result mapping, and exception handling. The sequence below begins with a model tool request and ends at the parent conversation boundary; external services and background workers retain their own lifecycles.

## Source-order walkthrough

### 1. Contract and rule identity (1–64)

The input URL schema validates URL syntax. webFetchToolInputToPermissionRuleContent safe-parses input and derives domain:hostname, falling back to input text on failure. Output bytes normally describe fetched bytes, but redirect responses use the generated instruction-message size.

### 2. Registration and permission ordering (66–181)

Metadata provides host description, activity summary, schemas, and URL/prompt classifier. The tool-specific checker first allows preapproved host/path pairs, then tests exact domain deny, ask, and allow rules, finally asks with a local-settings rule suggestion. This ordering is local to this checker; central policy still wraps it.

### 3. Prompt, validation, UI (183–217)

Prompt consistently includes authenticated/private-URL guidance to avoid schema-description churn. validateInput redundantly parses URL and reports code 1 on failure. UI provides fetch/progress/result rendering.

### 4. Fetch and cross-host redirect result (219–263)

Capture time and call getURLMarkdownContent with the abort controller. A disallowed-to-follow redirect returns instruction text containing original/redirect URL, status, and the original prompt for a future invocation. It does not fetch the new host in this call. Map common redirect codes to status text and return early.

### 5. Direct Markdown or secondary model (265–290)

For a preapproved URL with text/markdown MIME and content strictly shorter than MAX_MARKDOWN_LENGTH, use content directly. Otherwise call applyPromptToMarkdown(prompt, content, signal, noninteractive flag, preapproved flag). This is a separate model request, not another parent query-loop tool round.

### 6. Binary artifact note and result (292–319)

Append saved binary path/size/MIME when fetch conversion persisted raw bytes. Return timing and original URL; the model mapper emits only result. buildSuggestions constructs a local-settings allow rule for the derived domain.

### 7. Fetch dependency (utils.ts:63–479)

The helper validates URL, checks a 15-minute/50-MB URL cache before network, upgrades HTTP to HTTPS, and runs a hostname blocklist check unless settings skip it. Blocked/check-failed outcomes throw. Fetch uses abort signal, 60-second request timeout, 10-MB content cap, and bounded permitted redirects; cross-host redirects are returned for reauthorization. Raw binary can be persisted before UTF-8 decoding, HTML is converted via Turndown, and the converted entry is cached under the original URL.

### 8. Secondary model dependency (utils.ts:484–530)

Truncate content above 100,000 characters, build the secondary prompt, and call queryHaiku with the same signal and web_fetch_apply attribution. Recheck signal afterward and throw AbortError if aborted. Return the first text block or a no-response message. Binary persistence remains supplemental to this summarization path.

## End-to-end sequence

```mermaid
sequenceDiagram
    participant Q as Parent query
    participant E as Tool executor
    participant T as WebFetchTool
    participant D as Fetch helpers / secondary model
    Q->>E: tool_use(name, input, id)
    E->>E: Parse input, validate, run hooks and authorization
    alt Execution permitted
        E->>T: call(approved input, context)
        T->>D: getURLMarkdownContent(original URL, abort controller)
        alt Cached content
            D-->>T: Cached Markdown/metadata
        else Fetch needed
            D->>D: URL/domain preflight, HTTPS fetch with bounded redirects
            D->>D: Optional binary persistence, HTML-to-Markdown conversion, cache
            D-->>T: Content or redirect instruction data
        end
        alt Different-host redirect returned
            T->>T: Return instructions for a separately authorized WebFetch
        else Short preapproved Markdown
            T->>T: Use raw Markdown directly
        else Content processing required
            T->>D: queryHaiku(prompt + truncated content, abort signal)
            D-->>T: First text result
        end
        T->>T: Append saved binary note when applicable
        alt Call and result processing complete normally
            T-->>E: Structured data and optional side channels
            E->>T: mapToolResultToToolResultBlockParam(data, id)
            T-->>E: Model-facing tool_result
            E-->>Q: Tool result and associated events
        else Call or result processing throws
            E->>E: Failure handling and applicable failure hooks
            E-->>Q: Error result and associated events
        end
    else Validation, hook, or permission prevents execution
        E-->>Q: Rejection/error result, call is skipped
    end
    Note over E,Q: A thrown call or mapper error follows the executor error path.
    Q->>Q: Incorporate result, continue or terminate the query
```

The success arrows after `call` describe normal completion. An exception skips normal result mapping; see the failure boundaries below. Query continuation remains subject to cancellation and turn/budget limits.

## State, failure, and cancellation boundaries

A cached entry can bypass a fresh domain check until cache expiry. The permission prompt and blocklist are separate gates. Network/model failures throw; a cross-host redirect is a normal result. Binary files/cache entries may survive a later model failure. Domain-check timeout is distinct from fetch cancellation, and a returned summary is not an exact copy of the full page.
