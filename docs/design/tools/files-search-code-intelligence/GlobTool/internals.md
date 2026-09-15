# GlobTool Internals

Source: [tools/GlobTool/GlobTool.ts](../../../../../tools/GlobTool/GlobTool.ts). Line ranges refer to this recovered source snapshot; symbols are the stable navigation handles.

## Purpose and caller boundary

Finds file names matching a glob under an optional directory. Strict input requires pattern; output reports returned filenames/count, duration, and truncation. The read-only, concurrency-safe tool delegates traversal, filtering, and cancellation to utils/glob.ts.

The [shared invocation lifecycle](../../invocation-lifecycle.md) explains registry selection, schema validation, authorization, hooks, result mapping, and exception handling. The sequence below begins with a model tool request and ends at the parent conversation boundary; external services and background workers retain their own lifecycles.

## Source-order walkthrough

### 1. Schemas and metadata (1–89)

Path is optional and pattern is an unrestricted string. Output schema describes a 100-file limit, but context.globLimits.maxResults can override it at execution. Classifier and permission matcher use pattern; getPath expands a truthy path or uses cwd. Search classification is search true/read false.

### 2. Directory validation (90–133)

For a supplied path, expand and stat it. UNC-style paths skip filesystem preflight to avoid triggering network authentication before authorization; that skip is not an allow decision. ENOENT returns code 1 with cwd and optional suggestion; a non-directory returns code 2; other stat exceptions throw.

### 3. Permission and presentation (135–155)

checkReadPermissionForTool uses the current permission context and resolved path. Prompt and UI helpers describe file search. Transcript search indexes only joined filenames, excluding duration/count chrome.

### 4. Execute (157–179)

Capture start/state, choose maxResults or 100, then call glob(pattern, root, {limit, offset:0}, abort signal, permission context). Relativize returned paths under cwd, count only returned filenames, and preserve helper truncation. No file contents are read by this module.

### 5. Model result (180–199)

Empty list becomes ordinary No files found. Otherwise return one path per line plus truncation guidance when the helper says more results exist. Duration and count are not independently serialized.

## End-to-end sequence

```mermaid
sequenceDiagram
    participant Q as Parent query
    participant E as Tool executor
    participant T as GlobTool
    participant D as Glob traversal / permission context
    Q->>E: tool_use(name, input, id)
    E->>E: Parse input, validate, run hooks and authorization
    alt Execution permitted
        E->>T: call(approved input, context)
        T->>D: Resolve root and current read permission context
        T->>D: glob(pattern, root, limit, offset 0, abort signal)
        D-->>T: Files and truncation flag
        T->>T: Relativize paths, compute returned count and duration
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

A truncated numFiles is a returned-page count, not the full match count. Validation and traversal can race with filesystem changes. The helper owns subprocess/traversal termination; this tool forwards the abort signal and does not convert errors into empty results. UNC preflight skipping must be read together with the later permission check.
