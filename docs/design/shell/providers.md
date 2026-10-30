# Shell providers and command construction

Sources: [shellProvider.ts](../../../utils/shell/shellProvider.ts), [bashProvider.ts](../../../utils/shell/bashProvider.ts), [powershellProvider.ts](../../../utils/shell/powershellProvider.ts), [powershellDetection.ts](../../../utils/shell/powershellDetection.ts), [resolveDefaultShell.ts](../../../utils/shell/resolveDefaultShell.ts), and [shellToolUtils.ts](../../../utils/shell/shellToolUtils.ts).

## Contract and selection

`ShellProvider` contains `type`, `shellPath`, `detached`, `buildExecCommand`, `getSpawnArgs`, and `getEnvironmentOverrides`. Construction returns the script and cwd-file path; spawning and lifecycle ownership remain in [Shell.exec](./execution.md).

`Shell.findSuitableShell` checks a supported executable `CLAUDE_CODE_SHELL` override first, then prioritizes a supported executable `$SHELL`, then discovered/standard Bash and zsh locations. Executability uses `X_OK` with a one-second `--version` probe fallback. Shell choice prefers Bash when `$SHELL` contains bash, otherwise zsh. Failure throws. The provider key `bash` therefore does not guarantee `/bin/bash`.

PowerShell detection prefers `pwsh`, then `powershell`. On Linux it resolves symlinks to detect snap launchers and tries direct installation paths first, but can retain the original discovered path if no replacement works. A cached promise shares detection; edition inference uses the executable name, not a version subprocess.

`resolveDefaultShell()` selects the input-box `!` default from settings, falling back to `bash` everywhere. Separately, `isPowerShellToolEnabled()` is Windows-only, defaults on for internal users unless opted out, and requires opt-in for external users. Availability of a provider is not equivalent to visibility of the model-facing tool. Prompt frontmatter routing has its own source of shell choice; see [supporting utilities](./supporting-utilities.md).

## Bash provider, in source order

1. Start `createAndSaveSnapshot(shellPath)` once, or a resolved undefined promise for `skipSnapshot`. Catch snapshot rejection and continue with no snapshot.
2. In each `buildExecCommand`, await that promise and check access to the returned file. If missing, clear the locally selected snapshot so `getSpawnArgs` adds `-l`. The original snapshot promise is retained; this path does not rebuild it.
3. Save the selected snapshot path and sandbox temp directory in provider closure fields. Later `getSpawnArgs` and `getEnvironmentOverrides` read these fields; the returned command string alone is not all of the invocation state.
4. Choose the cwd file location: sandbox directory when enabled, otherwise OS temporary directory. Convert shell-visible paths for Git Bash on Windows.
5. Rewrite `>nul` forms, determine stdin redirect need, and quote the command for `eval`. Pipes needing stdin redirection go through `rearrangePipeCommand`.
6. Append snapshot sourcing with a missing-file guard, session environment script if present, and an extended-glob disabling command. Then append `eval <quoted command>` and `pwd -P >| <cwd file>`. Join parts with ` && `.
7. If `CLAUDE_CODE_SHELL_PREFIX` is set, wrap the assembled string using `formatShellPrefixCommand`. That helper is a limited prefix/path formatter, not a complete argv parser.
8. `getSpawnArgs` returns `['-c', commandString]` when a snapshot was selected, otherwise `['-c', '-l', commandString]`.

Snapshot access checking chooses the login fallback. The later `source ... || true` only tolerates a race in which the file disappears after the access check; it does not retroactively enable login initialization.

The provider uses `detached: true`. This is a process-spawn setting; the task is not considered backgrounded until the lifecycle/task layer performs the explicit transfer.

## PowerShell provider, in source order

The provider uses `detached: false` and does not create or source a Bash snapshot. It chooses a writable cwd-file path and escapes single quotes for PowerShell. It appends a trailer that captures `$LASTEXITCODE` if non-null, otherwise maps `$?` to 0/1, writes `(Get-Location).Path`, and exits with the captured status.

This deliberately prefers the last native executable's status. A native success followed by a failing cmdlet can therefore still report zero; a native failure followed by a successful cmdlet can retain the native failure. Do not describe it as simply the status of the last textual statement.

| Path | Construction |
|---|---|
| Unsandboxed | Spawn PowerShell with `-NoProfile -NonInteractive -Command <program plus trailer>` |
| Sandboxed | Provider encodes the program as UTF-16LE Base64 and returns a quoted PowerShell executable invocation with `-NoProfile -NonInteractive -EncodedCommand`; `Shell.exec` wraps/spawns through `/bin/sh` |

The encoded form avoids corruption across the sandbox's POSIX quoting layers and retains PowerShell startup flags that a generic `<shell> -c` wrapper could not supply.

## Environment ordering

| Provider | Override order within `getEnvironmentOverrides` |
|---|---|
| Bash/zsh | Optional isolated tmux socket; sandbox `TMPDIR`, `CLAUDE_CODE_TMPDIR`, `TMPPREFIX`; then `/env` session variables |
| PowerShell | `/env` session variables; then sandbox `TMPDIR`, `CLAUDE_CODE_TMPDIR` |

The Bash provider can defer tmux initialization until tmux is used. `TMPPREFIX` puts zsh heredoc temporary files in the sandbox directory. The ordering difference is real: Bash session variables can replace those temp overrides, while PowerShell sandbox temp overrides win. Shell script replay after spawn can further change environment values; this table only describes the initial process environment overrides.

For parsing/quoting guards and their limitations, see [Bash parsing](./bash-parsing.md). For what is captured once versus replayed per command, see [snapshots and environment](./snapshots-and-environment.md).
