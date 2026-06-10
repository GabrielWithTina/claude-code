# REPLTool Design

`REPLTool` is partially represented in this checkout. The actual `REPL` tool
implementation is not present under `tools/REPLTool`, but the folder defines
REPL-mode gating and the primitive tool set hidden behind REPL mode.

## Source Map

| File | Purpose |
|---|---|
| `tools/REPLTool/constants.ts` | REPL tool name, environment gates, and `REPL_ONLY_TOOLS`. |
| `tools/REPLTool/primitiveTools.ts` | Lazy primitive-tool list exposed inside the REPL VM context. |

## REPL Mode

REPL mode is enabled when `CLAUDE_REPL_MODE` is truthy, or by default for ant
interactive CLI sessions unless `CLAUDE_CODE_REPL` is explicitly false. SDK
entrypoints are not defaulted into REPL mode because SDK consumers expect direct
tool calls.

## Primitive Tools

When REPL mode is enabled, `REPL_ONLY_TOOLS` hides direct model access to
`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `NotebookEdit`, and `Agent`.
`getReplPrimitiveTools()` lazily returns those tool definitions for the REPL VM
and display-side rendering logic.

## Recovered Source Boundary

No `REPLTool.ts`, input schema, call implementation, permission flow, or UI
renderer is present in this folder.

