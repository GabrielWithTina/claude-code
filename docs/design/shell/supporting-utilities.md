# Supporting shell utilities and alternate entry points

These helpers either reuse the shared shell runtime or operate below it. Their execution/error contracts differ; they are not interchangeable wrappers.

## Direct subprocess wrappers

Sources: [execFileNoThrow.ts](../../../utils/execFileNoThrow.ts), [execFileNoThrowPortable.ts](../../../utils/execFileNoThrowPortable.ts), and [execSyncWrapper.ts](../../../utils/execSyncWrapper.ts).

| Function | Input and return | Snapshot/task lifecycle |
|---|---|---|
| `Shell.exec` | Shell text → async ShellCommand handle → separate result promise | Provider setup, snapshot for Bash, TaskOutput, cancellation/backgrounding |
| `execFileNoThrow` | Executable + argv → promise of stdout/stderr/code/error | Delegates to explicit-cwd wrapper; no snapshot or task handle |
| `execFileNoThrowWithCwd` | Executable + argv/options → collected result | execa with `reject: false`; optional shell, input, env, cwd, timeout |
| `execSyncWithDefaults_DEPRECATED` | Shell command → trimmed stdout or null | Blocking execaSync; tracked cwd; no snapshot/background handle |
| `execSync_DEPRECATED` | Shell command/options → Buffer or string | Direct Node execSync with slow-operation logging; exceptions propagate |

`execFileNoThrowWithCwd` maps normal failed process results into data, preserving output by default and selecting a readable error from shortMessage/signal/code. Disabling preservation returns empty streams. Its promise catch logs and returns empty streams/code 1. The name describes normal process-failure handling; a synchronous throw inside the outer Promise executor can still reject that promise.

Default objects and destructuring defaults differ here. `execFileNoThrow` defaults `useCwd: true` only when its whole options argument is omitted; passing an object without `useCwd` does not merge that property. Similarly, the explicit-cwd wrapper's default-object `maxBuffer` is not supplied by destructuring when an object without it is passed. Timeout and output-preservation do have destructuring defaults.

The portable synchronous wrapper accepts both its older AbortSignal signature and newer options signature. It calls `throwIfAborted` before the try block, then runs with process.env, tracked cwd, ten-minute default timeout, 1,000,000 output buffer, and `shell: true`. It returns nonempty trimmed stdout even for a normal nonzero result because reject is false; caught failures or empty stdout return null. It does not expose the ShellCommand cancellation protocol while blocked.

These wrappers do not automatically call `subprocessEnv()`. Callers choose scrubbing/proxy behavior. A utility named exec does not imply that shell startup files or the saved snapshot are loaded.

## Completion and command history

[bash/shellCompletion.ts](../../../utils/bash/shellCompletion.ts) classifies the cursor prefix as command, variable, or file context, respecting command-operator boundaries with tokenization and fallback heuristics. It generates Bash/zsh completion commands, calls `Shell.exec(..., 'bash', {timeout: ...})`, awaits the result, filters output lines, caps suggestions, and attaches the original input snapshot so the UI can discard stale matches. Unsupported shell types, empty prefixes, and caught errors yield no suggestions. It reuses execution setup but is not a model-generated Bash tool invocation.

[suggestions/shellHistoryCompletion.ts](../../../utils/suggestions/shellHistoryCompletion.ts) reads application history entries beginning with `!`; it does not read `.bash_history`/`.zsh_history`. It caches up to 50 recent unique commands from the history scan for 60 seconds, supports invalidation and move-to-front insertion, and returns full-command/suffix data for ghost text. This path performs no shell execution.

## Embedded commands in prompt text

Source: [promptShellExecution.ts](../../../utils/promptShellExecution.ts), `executeShellCommandsInPrompt`.

1. Resolve Bash by default, or lazy-load PowerShell when frontmatter requests it and the runtime gate permits it. This choice is not read from `settings.defaultShell`.
2. Find fenced exclamation command blocks and inline exclamation-backtick commands. Inline scanning is skipped unless its marker occurs in the text.
3. Process matches through `Promise.all`. For each nonempty command, call `hasPermissionsToUseTool` with the selected tool and synthetic assistant context.
4. Require an `allow` decision; other decisions throw `MalformedCommandError`. This entry point does not open the normal interactive canUseTool dialog.
5. Call the concrete tool directly with `{command}` and context. This bypasses the generic executor's `validateInput`/invocation pipeline; it is not equivalent to ordinary tool_use passing through all hooks and validation.
6. Convert output through `processToolResultBlock`, then replace matched prompt text using a function replacer so `$&`, `$$`, and similar output are not interpreted as replacement syntax.
7. Convert ShellError/interrupt/general failures into MalformedCommandError. Promise.all rejection does not cancel all other already-started matches.

The permission result is checked for allow, but this function passes the original command object to `call`; it does not apply `permissionResult.updatedInput` itself. This differs from the approved-input handling in the [generic tool executor](../tools/orchestration-internals.md).

## Shell configuration maintenance

Source: [shellConfig.ts](../../../utils/shellConfig.ts).

This module supports installer/configuration maintenance rather than per-command execution. `getShellConfigPaths` returns Bash, zsh, and fish rc paths and respects `ZDOTDIR` for zsh. `filterClaudeAliases` removes only aliases matching the installer's local Claude path and preserves custom targets. `readFileLines` returns null for inaccessible-file errors and rethrows other failures; `writeFileLines` writes joined text, calls datasync, and closes the handle in finally.

`findClaudeAlias` scans those files for a target; `findValidClaudeAlias` expands a leading tilde and stats it. Despite executable wording in comments, the latter's body checks file/symlink type rather than an executable permission bit. This differs from `Shell.findSuitableShell`'s executable probe.

## Operational boundaries

- Completion and prompt helpers can start processes for reasons other than model tool_use; trace the caller before assuming the generic permission/UI pipeline ran.
- Prefix extraction, history suggestions, config inspection, and snapshots have different cache lifetimes and invalidation rules.
- Configuration files execute when sourced during snapshot capture; alias maintenance reads them as text without evaluating them.
- None of these utilities creates a persistent terminal. [Snapshots](./snapshots-and-environment.md), [session scripts](./snapshots-and-environment.md#per-command-session-scripts), and [cwd tracking](./execution.md#working-directory-persistence) are the explicit persistence mechanisms.
