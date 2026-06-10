# PowerShellTool - Windows Shell Execution And File Boundaries

## Module Map

| File | Role |
|---|---|
| `tools/PowerShellTool/PowerShellTool.tsx` | Tool definition, schema, validation, execution, backgrounding, output persistence, image handling, and result mapping |
| `tools/PowerShellTool/prompt.ts` | Model-facing syntax, edition, timeout, backgrounding, and dedicated-file-tool guidance |
| `tools/PowerShellTool/powershellPermissions.ts` | Permission decision pipeline and rule matching |
| `tools/PowerShellTool/pathValidation.ts` | Filesystem boundary checks for PowerShell cmdlets and aliases |
| `tools/PowerShellTool/readOnlyValidation.ts` | Read-only command classification and security heuristics |
| `tools/PowerShellTool/powershellSecurity.ts` | Parser and injection-safety checks |
| `tools/PowerShellTool/commandSemantics.ts` | Non-zero exit-code interpretation for commands with special meanings |
| `tools/PowerShellTool/modeValidation.ts` | Permission-mode checks for write-like or link-creating commands |
| `tools/PowerShellTool/gitSafety.ts` | Git-internal path and bare-repository safety checks |
| `tools/PowerShellTool/UI.tsx` | Tool-use, progress, queued, error, and result rendering |
| `utils/powershell/parser.ts` | PowerShell parser used by permission analysis |
| `utils/shell/powershellDetection.ts` | PowerShell executable and edition detection |

## Purpose

`PowerShellTool` is the Windows-oriented shell execution tool. Like `BashTool`,
it can affect files indirectly through shell commands, but its prompt tells the
model to prefer specialized file tools for reading, writing, editing, finding,
and searching files.

This document focuses on the file-related design boundary: PowerShell commands
are allowed for terminal work, while file operations receive extra permission,
path, read-only, sandbox, and git-safety scrutiny.

## Enablement And Registration

`tools.ts` includes `PowerShellTool` only through `getPowerShellTool()`, which
returns the tool when `isPowerShellToolEnabled()` is true. The tool itself
reports `isEnabled() === true`; outer detection decides whether it is exposed.

The tool name is `PowerShell`, with a search hint for executing Windows
PowerShell commands.

## Tool Shape

Input:

| Field | Meaning |
|---|---|
| `command` | PowerShell command string to execute |
| `timeout` | Optional timeout in milliseconds, capped by shell timeout settings |
| `description` | User-facing command summary |
| `run_in_background` | Optional background execution flag, omitted from schema when background tasks are disabled |
| `dangerouslyDisableSandbox` | Optional override for sandbox mode |

Output:

| Field | Meaning |
|---|---|
| `stdout` / `stderr` | Captured output |
| `interrupted` | Whether execution was aborted |
| `returnCodeInterpretation` | Semantic note for special non-error exit codes |
| `isImage` | Whether stdout was converted into an image block |
| `persistedOutputPath` / `persistedOutputSize` | Path and size for large output saved to disk |
| `backgroundTaskId` | Background task id for long-running commands |
| `backgroundedByUser` / `assistantAutoBackgrounded` | Backgrounding source |

## Prompt Boundary

The prompt explicitly says not to use PowerShell for file operations when a
dedicated tool exists:

- file name search: `GlobTool`,
- content search: `GrepTool`,
- reading: `FileReadTool`,
- editing: `FileEditTool`,
- whole-file writing: `FileWriteTool`.

This is guidance, not the security boundary. The actual boundary is enforced by
validation, permissions, sandboxing, and path analysis.

## Validation And Permission Flow

`validateInput()` blocks native Windows execution when enterprise policy
requires sandboxing but sandboxing is unavailable. The same check is repeated at
the top of `call()` because some internal callers invoke the tool directly and
skip normal validation.

When monitor tooling is compiled in, foreground sleep patterns of two seconds
or longer are rejected unless the command is explicitly backgrounded.

`checkPermissions()` delegates to `powershellToolHasPermission()`. The
permission pipeline parses PowerShell, resolves aliases and module-qualified
names, applies deny/ask/allow rules case-insensitively, classifies read-only
commands, checks path constraints, detects dangerous removals, and guards git
internals such as hooks, refs, objects, and `HEAD`.

Important file-specific defenses include:

- Canonical cmdlet matching for aliases such as `rm`, `cat`, `ls`, `mkdir`,
  `ren`, and native `.exe` names.
- Path validation for writer cmdlets such as `New-Item`, `Set-Content`,
  `Copy-Item`, `Move-Item`, `Rename-Item`, archive extraction, and redirects.
- UNC path and parser-differential checks before read-only auto-allow.
- Extra asks for archive extraction followed by git operations, because archive
  contents can create git-internal paths after permission evaluation.

## Read-Only And Concurrency

`isConcurrencySafe()` returns true only when `isReadOnly()` does. The synchronous
`isReadOnly()` method is conservative because the full parser is async; it first
rejects commands with sync-detected security concerns and then only recognizes
simple read-only commands. The more complete read-only auto-allow path happens
inside the async permission checker where the parsed AST is available.

The UI separately classifies search/read commands such as `Select-String`,
`Get-ChildItem`, `Get-Content`, `Test-Path`, `Resolve-Path`, `Get-FileHash`,
and `Format-Hex` so search/read outputs can render compactly.

## Execution Flow

`call()` runs `runPowerShellCommand()` and streams progress through tool
progress messages. Execution uses the detected PowerShell binary and edition
guidance from `powershellDetection`.

Sandbox behavior mirrors Bash where supported: Linux, macOS, and WSL2 can wrap
`pwsh` with the sandbox adapter. Native Windows cannot, so enterprise policy can
block execution instead of silently running unsandboxed.

After execution, the tool:

1. Tracks git/PR operations when the command actually ran.
2. Resets cwd if the main thread moved outside the project.
3. Returns early for backgrounded commands with a task id and output path.
4. Interprets command-specific exit codes before deciding whether to throw
   `ShellError`.
5. Persists large output into the tool-results directory so the model can read
   it later with `FileReadTool`.
6. Converts supported image output into image tool results when possible.
7. Logs command metadata and returns structured stdout/stderr output.

## Sources

- `tools/PowerShellTool/PowerShellTool.tsx`
- `tools/PowerShellTool/prompt.ts`
- `tools/PowerShellTool/powershellPermissions.ts`
- `tools/PowerShellTool/pathValidation.ts`
- `tools/PowerShellTool/readOnlyValidation.ts`
- `tools/PowerShellTool/powershellSecurity.ts`
- `tools/PowerShellTool/gitSafety.ts`
