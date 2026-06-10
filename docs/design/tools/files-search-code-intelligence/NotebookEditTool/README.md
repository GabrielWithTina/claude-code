# NotebookEditTool - Jupyter Notebook Cell Editing

## Module Map

| File | Role |
|---|---|
| `tools/NotebookEditTool/NotebookEditTool.ts` | Tool definition, schema, validation, permission check, notebook JSON mutation, and writeback |
| `tools/NotebookEditTool/constants.ts` | Tool name constant: `NotebookEdit` |
| `tools/NotebookEditTool/prompt.ts` | Model-facing description and usage prompt |
| `tools/NotebookEditTool/UI.tsx` | Tool-use summary, rejection rendering, error rendering, and result rendering |
| `components/NotebookEditToolUseRejectedMessage.tsx` | Shared rejected-edit UI component |
| `components/permissions/NotebookEditPermissionRequest/NotebookEditPermissionRequest.tsx` | Permission prompt for notebook edits |
| `components/permissions/NotebookEditPermissionRequest/NotebookEditToolDiff.tsx` | Notebook cell diff rendering inside the permission prompt |
| `utils/notebook.ts` | Cell-id helpers such as `parseCellId()` |

## Purpose

`NotebookEditTool` edits Jupyter notebook files as structured `.ipynb` JSON
instead of treating them as plain text. `FileEditTool` explicitly redirects
notebook edits here, because notebook cell operations need cell identity,
cell-type handling, output clearing, notebook metadata preservation, and JSON
writeback.

The tool supports three modes:

| Mode | Behavior |
|---|---|
| `replace` | Replaces an existing cell source. If the target is one past the end, it is converted to an insert. |
| `insert` | Inserts a new code or markdown cell after `cell_id`, or at the beginning when no `cell_id` is supplied. |
| `delete` | Removes the addressed cell. |

## Tool Shape

The input schema requires `notebook_path` and `new_source`, with optional
`cell_id`, `cell_type`, and `edit_mode`.

Important schema conventions:

- `notebook_path` is described as an absolute `.ipynb` path, but the
  implementation also resolves relative paths against `getCwd()`.
- `cell_id` can match a real notebook cell id or the synthetic numeric
  `cell-N` style parsed by `parseCellId()`.
- `cell_type` is required for `insert`, optional for `replace`, and ignored by
  `delete`.

The output includes the edited source, cell id/type, language, edit mode, an
optional error string, and both `original_file` and `updated_file` for
attribution.

## Validation Flow

`validateInput()` performs the file-specific gates before any mutation:

1. Resolve the notebook path, while avoiding filesystem probes for UNC paths.
2. Require the `.ipynb` extension.
3. Require `edit_mode` to be `replace`, `insert`, or `delete`.
4. Require `cell_type` for inserts.
5. Enforce read-before-edit through `ToolUseContext.readFileState`.
6. Reject stale edits when the file mtime is newer than the last recorded read.
7. Read the notebook with `readFileSyncWithMetadata()`.
8. Parse the notebook JSON and reject invalid JSON.
9. Resolve `cell_id` as a real cell id or parsed numeric index.

The read-before-edit and stale-mtime checks match the safety model used by
`FileEditTool` and `FileWriteTool`: the model must have seen the notebook
contents before it can modify them.

## Execution Flow

`call()` re-resolves the notebook path, records file history when enabled, then
reads content, encoding, and line endings in one pass with
`readFileSyncWithMetadata()`.

The notebook is parsed with non-memoized `jsonParse()` because the code mutates
the parsed object in place. Reusing the memoized JSON parser would poison the
shared parse cache for later validation or calls with the same content string.

After locating the cell index, the mutation path is:

- `delete`: `cells.splice(index, 1)`.
- `insert`: build a code or markdown cell, generate an id for notebook format
  4.5+, and splice it into the cell array.
- `replace`: update `source`, optionally update `cell_type`, and clear code
  cell `execution_count` plus `outputs`.

Writeback uses `jsonStringify(notebook, null, 1)` and `writeTextContent()` so
the original encoding and line endings are preserved. After writing, the tool
updates `readFileState` with the new content and mtime so a subsequent
`FileReadTool` call does not return a stale unchanged-file stub.

## Permissions

`checkPermissions()` delegates to `checkWritePermissionForTool()`, using
`notebook_path` as the permission path. `toAutoClassifierInput()` includes the
path, edit mode, and new source only when transcript classification is enabled.

## UI

`UI.tsx` renders the displayed path through `FilePathLink`, uses a compact
`path@cell_id` summary in normal mode, and delegates rejection rendering to
`NotebookEditToolUseRejectedMessage`. Successful results show the updated cell
id and syntax-highlighted source using `HighlightedCode`.

## Sources

- `tools/NotebookEditTool/NotebookEditTool.ts`
- `tools/NotebookEditTool/UI.tsx`
- `tools/NotebookEditTool/prompt.ts`
- `tools/FileEditTool/FileEditTool.ts`
