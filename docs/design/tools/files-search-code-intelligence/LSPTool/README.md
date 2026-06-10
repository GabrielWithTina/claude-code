# LSPTool - File-Based Code Intelligence

## Module Map

| File | Role |
|---|---|
| `tools/LSPTool/LSPTool.ts` | Tool definition, validation, LSP request dispatch, gitignore filtering, result counting, and result mapping |
| `tools/LSPTool/schemas.ts` | Discriminated input schema for every LSP operation |
| `tools/LSPTool/prompt.ts` | Tool name and model-facing operation list |
| `tools/LSPTool/formatters.ts` | Formatting for locations, symbols, hover data, and call hierarchy results |
| `tools/LSPTool/symbolContext.ts` | Synchronous best-effort symbol extraction for the tool-use UI |
| `tools/LSPTool/UI.tsx` | Tool-use rendering and collapsed/expanded result summaries |
| `services/lsp/manager.ts` | LSP server manager access, initialization status, and request transport |

## Purpose

`LSPTool` provides read-only code intelligence over files through configured
Language Server Protocol servers. It does not edit files. It uses a file path
plus an editor-style position to request definitions, references, hover text,
document symbols, workspace symbols, implementations, and call hierarchy data.

The tool is registered only when `ENABLE_LSP_TOOL` is truthy and is active only
when `isLspConnected()` returns true.

## Tool Shape

The public `inputSchema` is a regular strict object so it fits the generic tool
interface. `validateInput()` then checks the richer discriminated union from
`schemas.ts` for operation-specific validation.

Supported operations are:

| Operation | LSP request |
|---|---|
| `goToDefinition` | `textDocument/definition` |
| `findReferences` | `textDocument/references` with `includeDeclaration: true` |
| `hover` | `textDocument/hover` |
| `documentSymbol` | `textDocument/documentSymbol` |
| `workspaceSymbol` | `workspace/symbol` with an empty query |
| `goToImplementation` | `textDocument/implementation` |
| `prepareCallHierarchy` | `textDocument/prepareCallHierarchy` |
| `incomingCalls` | `textDocument/prepareCallHierarchy`, then `callHierarchy/incomingCalls` |
| `outgoingCalls` | `textDocument/prepareCallHierarchy`, then `callHierarchy/outgoingCalls` |

Positions are model-facing 1-based line and character values. The request
builder converts them to the 0-based LSP protocol position.

## Validation Flow

`validateInput()`:

1. Validates the operation-specific shape with `lspToolInputSchema()`.
2. Expands `filePath` through `expandPath()`.
3. Skips local filesystem checks for UNC-style paths to avoid credential leaks.
4. Requires the path to exist.
5. Requires the path to be a regular file.

Permission checking delegates to `checkReadPermissionForTool()`, and the tool is
marked read-only, concurrency-safe, and `isLsp: true`.

## Execution Flow

`call()` waits for pending LSP initialization before accessing the manager. If
no manager exists, or if no server is available for the file extension, it
returns a normal tool result describing the unavailable server rather than
throwing.

Before the first request for a file, the tool opens the file through the LSP
manager. It reads the file only if the manager does not already have it open and
rejects analysis for files larger than 10 MB. The open-file step is necessary
because many LSP servers require `textDocument/didOpen` state before position
requests work.

Location-bearing results are filtered through `git check-ignore` in batches of
50 paths. Filtering applies to definitions, references, implementations, and
workspace symbols. This keeps ignored files out of model-facing results while
leaving non-location operations untouched.

## Result Formatting

`formatResult()` normalizes LSP response variants into:

- `result`: formatted text for the model.
- `resultCount`: number of definitions, references, symbols, hover items, or
  call entries.
- `fileCount`: number of unique files represented by the result.

The formatter layer handles malformed or missing URIs defensively, converts
`file://` URIs into display paths, decodes percent escapes when possible, and
uses relative paths when they are shorter and do not escape far above the cwd.

## UI

`renderToolUseMessage()` shows the operation, path, and position. For common
position-based operations it synchronously reads up to 64 KB from the file and
extracts the symbol under the cursor, falling back to `line:character` when the
symbol cannot be found.

`renderToolResultMessage()` shows a one-line collapsed summary when counts are
available and exposes full formatted content in verbose mode.

## Sources

- `tools/LSPTool/LSPTool.ts`
- `tools/LSPTool/schemas.ts`
- `tools/LSPTool/formatters.ts`
- `tools/LSPTool/symbolContext.ts`
- `tools/LSPTool/UI.tsx`
