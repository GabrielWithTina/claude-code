# BashTool Internals

Source: [tools/BashTool/BashTool.tsx](../../../../../tools/BashTool/BashTool.tsx). Line ranges refer to this recovered source snapshot; symbols are the stable navigation handles.

## IMHO - Overall Sequence Flow

### `mapToolResultToToolResultBlockParam`

- Structured output (TODO, when cut this?)
- Image based64
- Text
  - Large size result
  - The error message appends interrupted prompt if any
  - Background information 

### `call`

- iterate`runShellCommand` generator
- For progressive results, call `onProgress` callback to render the progresses to the caller (UI)
- Process the final result
- Keep only the specified maximum length of  `stdout` to avoid the oversized outcome
- Inspect and normalize the error code and error message from the the exit code. some of non-zero exit code doesn't mean error.
- If current agent is the main agent, reset the working directory to the original one in case it has been changed by the bash execution.
- If the result is huge and has associated output file path, link/copy the file to the dedicated project scope path
- Non-interrupted error raises the exception.
- If `stdout` is an image, resize the image with an appropriate size.
- return


### `TaskOutput`

File: `utils/task/TaskOutput.ts`

This description covers the normal Bash file-mode path; hook/pipe-mode behavior is outside its scope.

`TaskOutput` manages captured command output and progress snapshots. **`TaskOutputCapture`** could be a more explicit name. It does not itself own the command’s execution
status or exit code.

- **Construction:** The constructor receives a task ID, progress callback, capture-mode flag, and optional memory limit. It derives the output-file path from the task ID.
In Bash file mode, the child writes stdout and stderr directly into that file throughout execution.

- **Shared static fields:**
  - `#registry`: File-mode instances that have a progress callback.
  - `#activePolling`: Registered instances currently selected for polling.
  - `#pollInterval`: The handle for the single shared polling timer.

- **`startPolling(taskId)`:** Looks up the registered instance and adds it to `#activePolling`. If no timer exists, it creates a one-second interval that calls `#tick()`.
The timer is unreferenced so it cannot alone keep the application running.

- **`#tick()`:** For each active instance with a callback:
  - Starts an asynchronous `tailFile()` read of at most the last 4,096 bytes, without awaiting it.
  - When the read completes, rechecks that the callback still exists.
  - If content is empty, invokes `onProgress` with empty previews. This still wakes the Bash progress loop so it can check lifecycle changes.
  - Otherwise, scans the sample to extract short and longer previews targeting the last 5 and 100 lines.
  - Uses the sample’s line count directly when the whole file fits, or estimates the total from sample density when it does not. These are display-oriented counts, with newline-counting edge cases.
  - Updates stored counters and calls `onProgress` with previews, total lines, file size, and whether earlier bytes were omitted.
  - Ignores read failures.
  
  The previews are snapshots, not a queue of every output change. Because reads are not awaited, successive ticks can overlap.
  
- **`stopPolling(taskId)`:** Removes the instance from active polling. If no active instances remain, it clears the shared timer. Reads already in flight are not
canceled.

- **`getStdout()`:** Reads a bounded **prefix** of the output file, unlike progress polling, which reads its tail. After a successful read, it records file size and sets
  `#outputFileRedundant`:
  - `true` when the entire output fits inline.
  - `false` when additional output remains in the file.

  Downstream shell/tool code uses this information to delete redundant files or preserve larger output and expose its location.

### `ShellCommandImpl`

File: `utils/ShellCommand.ts`

This description covers the normal Bash file-mode path; hook/pipe-mode behavior is outside its scope.

`ShellCommandImpl` **manages an already-spawned shell process: completion, cancellation, timeout, backgrounding, and final result assembly.** `Shell.exec()` launches the
process first, then `wrapSpawn()` constructs this wrapper.

**Construction:** The constructor receives the child process, abort signal, timeout, `TaskOutput`, optional automatic-backgrounding flag, and optional output-size limit.
It stores these dependencies and creates the public `result` Promise. Bash stdout and stderr already point to the output file, so no JavaScript stream wrappers are created in this mode.

**Important instance fields:**

- `#status`: Initially `running`; can become `backgrounded`, `completed`, or `killed`.
- `#backgroundTaskId`: Identifies the task that owns the backgrounded command.
- `#childProcess`: The process handle supplied by `Shell.exec()`.
- `taskOutput`: Captures output and supplies progress previews and final output.
- `#timeoutId`: Handle for the foreground execution timeout.
- `#sizeWatchdog`: Handle for periodic background-output size checks.
- `#exitCodeResolver`: Completes the internal Promise carrying the exit-code number.
- `#resultResolver`: Completes the public `result` Promise carrying the full `ExecResult`.
- `#boundAbortHandler`: Saved callback reference, allowing the abort listener to be removed later.
- `#onTimeoutCallback`: Optional callback registered by the caller to handle timeout through backgrounding.

**`#createResultPromise()`:** Installs lifecycle listeners and constructs two connected Promises.

- Registers a one-time abort listener.
- Registers one-time child-process `exit` and `error` listeners.
- Starts the foreground timeout.
- Creates `exitPromise`, saving its resolver in `#exitCodeResolver`.
- Creates the public result Promise, saving its resolver in `#resultResolver`.
- Registers `#handleExit` through `exitPromise.then(...)`.

The process event resolves `exitPromise` with a number. `#handleExit(code)` then reads the output, builds `ExecResult`, and resolves the public result Promise.

The implementation listens for `exit`, not `close`, so completion does not wait for descendant processes to close inherited output descriptors.

**`#exitHandler(code, signal)`:** Converts the process exit event into a numeric result and calls `#resolveExitCode()`.

- Uses the supplied exit code when available.
- If there is no exit code and the signal is `SIGTERM`, maps it to `144`.
- Otherwise falls back to `1`.

The `144` mapping is the current implementation’s behavior, distinct from its internal timeout code of `143`.

**`#errorHandler()`:** Calls `#resolveExitCode(1)` when the child process emits an error.

**`#resolveExitCode(code)`:** Calls the saved exit-Promise resolver, then clears the reference. Later exit/error/kill paths cannot resolve it again. The first path that
reaches this method with an available resolver determines the result code.

**`#handleExit(code)`:** Assembles the final command result.

- Clears lifecycle timers and removes the abort listener.
- Changes `running` or `backgrounded` status to `completed`; preserves `killed`.
- Awaits `taskOutput.getStdout()`.
- Builds `ExecResult` with the code, stdout, stderr, interruption flag, and optional background task ID.
- For foreground output that fits entirely inline, requests deletion of the redundant output file.
- For larger foreground output, includes the file path, size, and task ID.
- Keeps background output files for later task consumption.
- Adds a diagnostic for output-size termination or timeout when applicable.
- Resolves the public `result` Promise.

`completed` means execution has finished, not necessarily succeeded. A nonzero code can still have this wrapper status; higher layers interpret success or failure.

**`#abortHandler()`:** If the abort reason is `'interrupt'` (user submitted a new message), returns without killing the process, leaving the caller an opportunity to background it. Other abort reasons call `kill()`.

This handler does not itself perform backgrounding.

**`onTimeout(callback)`:** Available when automatic backgrounding is enabled. Calling it stores the supplied callback; it does not invoke it immediately.  (assign `#onTimeoutCallback` to `startBackgrounding` in `BashTool.tsx line 1036`

**`#handleTimeout(self)`:** Runs when the foreground timeout expires.

- If automatic backgrounding is enabled and a callback is registered, invokes that `#onTimeoutCallback` with `self.background.bind(self)`.
- Otherwise calls `#doKill(143)`.

The callback receives the bound `background()` method and can call it after arranging task ownership.

**`background(taskId)`:** Transitions a running command into background execution.

- Returns `false` if the command is no longer `running`.
- Records the background task ID and changes status to `backgrounded`.
- Removes the foreground timeout and abort listener.
- Starts the file-size watchdog.
- Returns `true`.
- The primary purpose of this function is to clean up the foreground related resources, start file-size watchdog for background,  and set status as `background`.

It does not spawn another process, move output to another file, or resolve the command’s result Promise. The existing child continues writing to the same output file. The
higher-level caller can return a background-task handle while the command continues. (we will talk more later on)

**`#startSizeWatchdog()`:** Every five seconds, asynchronously checks the output-file size. If the command is still backgrounded and the file exceeds the configured limit
—5 GiB by default—it marks the size-limit condition and calls `#doKill(137)`.

The timer is unreferenced so it cannot alone keep the application running. Failed size checks are ignored. Because enforcement is periodic, the file can exceed the limit
before termination occurs.

**`kill()` and `#doKill(code)`:** Mark the command as killed, request `SIGKILL` for the process tree when a PID exists, and resolve the internal exit Promise immediately.

The supplied numeric code classifies the result; it does not select the OS signal:

- Normal `kill()` uses result code `137`.
- Timeout uses result code `143`.
- Output-size termination uses result code `137`.
- All these paths request the OS signal `SIGKILL`.

Because the resolver is called immediately, result assembly does not wait for a subsequent process-exit event. `ExecResult.interrupted` is calculated as `code === 137`.

**`#cleanupListeners()`:** Clears the timeout and size watchdog and removes the saved abort listener. It deliberately leaves the process `exit` and `error` listeners installed so they can still complete the result.

**`cleanup()`:** Clears `TaskOutput` resources, removes lifecycle timers/listeners, and releases references to the child process, abort signal, and timeout callback.

Cleanup is separate from termination: it does not itself kill the child or automatically delete its output file. The owner should call it when execution ownership and
output handling have finished.

### `runShellCommand`

#### Overall flow

- Define a `createProgressSignal` function which activates `race` function so that we can yield updated progress events.
- call `exec` function that prepares and launches a new shell process, connects output capture, and returns a `ShellCommand` handle for managing its lifecycle. It does not wait for the command to finish.
- Set up auto-backgrounding callback on timeout of `ShellCommandImpl` if enabled
- If the caller requires run shell in background, call `spawnBackgroundTask` and return
- Race result and `PROGRESS_THRESHOLD_MS(2s)` so that it gives us a chance to get the result without polling the task output file.
- Start polling `TaskOutput`
- loop for `Promise.race([resultPromise, progressSignal]` to get either progress events or final result.
- any type of return from loop will finally stop polling `TaskOutput`.

#### `createProgressSignal`

- Define a `createProgressSignal` function that returns a promise resolving to `null`. Calling its `resolve` function is similar to calling `set_result` on a Python `Future`.

  - When the underlying `exec` function runs, create an associated signal to wake the progress-processing loop. At line 1036, the loop waits for either the final result or a progress signal:

    ```python
    const result = await Promise.race([resultPromise, progressSignal]);
    ```

  - The underlying `exec` function’s `onProgress` callback resolves any pending progress signal and clears the reference to it. This resumes the loop at line 1036, allowing it to yield the latest progress event.

  - This approach adapts a regular function with progress callbacks into an asynchronous generator, similar to `streamedCheckPermissionsAndCallTool` at line 492 in `toolExecution.js`. The main difference is that this approach retains only the latest progress event, whereas the latter queues all progress events.


#### `exec`

File: `utils/Shell.ts`

This description covers the normal Bash file-mode path; hook/pipe-mode behavior is outside its scope.

`exec()` **prepares and launches a new shell process, connects output capture, and returns a `ShellCommand` handle for managing its lifecycle. It does not wait for the command to finish.**

**Parameters:**

- `command`: The shell command to execute.
- `abortSignal`: Signal used to manage cancellation.
- `shellType`: Selects the Bash or PowerShell provider.
- `options`: Optional timeout, progress callback, cwd policy, sandbox flag, automatic-backgrounding flag, and stdout callback.

**Return value:** `Promise<ShellCommand>`. Awaiting `exec()` waits for setup and launch. Awaiting the returned handle’s `result` waits for the command result.

**Select the shell provider:** Resolves the provider for the requested shell type. The provider supplies the shell executable, command construction, launch arguments, and
environment overrides.

**Build the command script:** Calls `provider.buildExecCommand()`. For Bash, this prepares snapshot/environment setup, command evaluation, stdin handling, and **a command that writes the final working directory into a temporary cwd file.**

The cwd file is separate from the task output file.

- **The cwd file records the shell’s final working directory,** so Claude Code can use that directory for subsequent commands.
-   The generated script therefore appends: `pwd -P >| /tmp/claude-<id>-cwd`


**Validate the working directory:** Checks whether the current directory still exists. If unavailable, attempts to fall back to the original working directory. If neither directory is available, returns a failed-command handle.

**Check cancellation:** If the abort signal is already aborted at the pre-spawn check, returns an aborted-command handle without launching the shell.

**Apply optional sandboxing:** If `shouldUseSandbox` is enabled, wraps the prepared command through `SandboxManager.wrapWithSandbox()` and attempts to create the sandbox
temporary directory.

`exec()` itself does not perform the tool permission-approval interaction.

**Prepare output capture:**

- Generates a task ID.
- Creates a `TaskOutput` instance.
- Creates the output directory.
- Opens the task output file.
- Configures child stdout and stderr to write to the same file.

The child writes directly to that file through its inherited file descriptors. JavaScript does not receive and persist each output chunk in this mode.

**Launch the process:** Calls `spawn()` with the shell executable, prepared arguments, environment, working directory, and stdio configuration.

This is where process execution is initiated. Each invocation creates a new shell process.

**Attach lifecycle management:** Calls `wrapSpawn()` to construct `ShellCommandImpl`, passing the child process, abort signal, timeout, `TaskOutput`, and automatic-
backgrounding flag.

`ShellCommandImpl` manages completion, cancellation, timeout, background-state transitions, and background output-size monitoring.

The parent then closes its own output-file handle. The child retains its inherited descriptors and continues writing.

**Register completion-side cleanup:** Attaches a callback to `shellCommand.result` `void shellCommand.result.then(async result => {...}` that later: 

- Performs sandbox cleanup when applicable.
- Reads the cwd file and updates application cwd when cwd changes are allowed and the command was not backgrounded.
- Invalidates the session environment cache if cwd changed.
- Deletes the temporary cwd file.

Registering this callback does not wait for command completion. This cleanup does not delete the task output file.

**Return the handle:** Returns `shellCommand`, potentially while the child process is still running.

**The two completion boundaries:**

- `await exec(...)`: Wait for command preparation, process launch, and wrapper setup.
- `await shellCommand.result`: Wait for the lifecycle wrapper to produce the command result.

**Responsibility boundaries:**

- `BashTool.runShellCommand()`: Foreground/background orchestration and progress delivery.
- `exec()`: Command preparation, process launch, and component setup.
- Child process: Actual command execution.
- `TaskOutput`: Output capture, progress snapshots, and output retrieval.
- `ShellCommandImpl`: Process lifecycle management and result assembly.

**Error handling:** Several failures produce special command handles, including an unavailable working directory, an already-aborted signal, and errors caught in the spawn/setup region.

Not every setup failure is converted into a command result. Operations before the spawn-region `try`, such as provider setup or opening the output file, can reject the `exec()` Promise directly.

## Purpose and caller boundary

Executes a Bash command or applies an internal approved sed preview, streams progress, and returns either completion data or a background-task handle. Model input is strict command plus optional timeout/description/background/sandbox override. The internal _simulatedSedEdit field is excluded from the model schema. Concurrency safety depends on read-only command analysis; UI search/read classification is a separate heuristic.

The [shared invocation lifecycle](../../invocation-lifecycle.md) explains registry selection, schema validation, authorization, hooks, result mapping, and exception handling. The sequence below begins with a model tool request and ends at the parent conversation boundary; external services and background workers retain their own lifecycles.

## Source-order walkthrough

### 1. Imports and UI classification (1–171)

Dependencies cover shell/security parsing, permissions, task ownership, output storage, sed/history, sandboxing, image handling, hints, and telemetry. isSearchOrReadBashCommand splits operators, skips redirect targets/operators and neutral commands, and requires every remaining command to belong to search/read/list sets. Parse failure/neutral-only returns all false. This controls collapse labels, not permission.

### 2. Silent-command heuristic (173–220)

isSilentBashCommand requires at least one nonfallback command and all such commands in a silent set. Neutral fallback after || is ignored, while other unsupported commands make it false. The result selects Done versus No output UI, not command success semantics.

### 3. Background gate, schemas, and logging classifier (222–296)

Read CLAUDE_CODE_DISABLE_BACKGROUND_TASKS at module load because it changes schema exposure. fullInputSchema includes internal sed preview; public schema always omits it and conditionally omits run_in_background. Timeout is a semantic number without a max refinement here. getCommandTypeForLogging recognizes common background executables. Output includes streams, interruption, background cause, images/structured content, semantic result text, and persisted-output metadata.

### 4. Delay helpers (298–344)

isAutobackgroundingAllowed compares the first split subcommand with the disallowed sleep entry. detectBlockedSleepPattern separately recognizes leading integer sleep >=2 seconds, including a following command, while fractional/sub-two-second pacing is not blocked. Do not equate this shallow helper with a complete shell parse.

### 5. Approved sed write helper (346–410)

applySedEdit expands target, detects encoding, reads original content, and returns normal stderr text if that read reports ENOENT. It optionally snapshots history, preserves detected line endings, writes approved newContent directly, notifies VSCode, and updates full read state. It does not run sed or repeat FileEdit’s stale-content validation. The preview field’s trust comes from permission UI injection.

### 6. Metadata, read-only scheduling, hook matcher (412–489)

isReadOnly combines commandHasAnyCd and checkReadOnlyConstraints; isConcurrencySafe delegates to it. preparePermissionMatcher uses parseForSecurity: unavailable/complex parsing matches all rules to avoid skipping a hook. Simple commands strip leading assignments via argv and match any subcommand by prefix or wildcard. UI names sed edits like file edits and conditionally shows sandbox indicator; summary prefers supplied description.

### 7. Validation and authorization (491–554)

With MONITOR_TOOL and background enabled, a nonbackground blocked sleep gets validation code 10. Other input passes this validator. bashToolHasPermission owns detailed command/path/sandbox permission logic. UI/search extraction displays stdout/stderr only; model wrappers and background path text are separate.

### 8. Model mapper (555–622)

Structured content wins, then valid image data. Otherwise trim leading blank lines/end whitespace, wrap persisted-output preview if a path exists, append stderr and interrupted error text, and add explicit/manual/assistant-budget background guidance. Text is_error equals interrupted; ordinary nonzero command failures normally threw earlier. The early structured/image branches do not run that final interrupted flag assignment.

### 9. Call entry and generator consumption (624–690)

Internal sed preview returns immediately through applySedEdit. Otherwise allocate a bounded stdout accumulator and determine main versus agent context; agents prevent cwd changes. Consume runShellCommand manually with next(), forwarding yielded progress with synthetic IDs and capturing the generator RETURN ExecResult. Background task registration uses setAppStateForTasks when available.

### 10. Semantic exit handling (692–735)

Track git operations, identify user interrupt only when result.interrupted and signal.reason is interrupt, append merged stdout/stderr, and interpret exit status. Log index.lock diagnostics. Root calls reset cwd if outside permitted project context. Annotate sandbox failures; preSpawnError throws directly, and semantic errors throw ShellError unless it was a user interrupt. finally clears tool JSX even when this region throws.

### 11. Large-output preservation (737–763)

After successful/interrupt return, if output path/task ID exist, stat and remember ORIGINAL size, ensure result directory, truncate the SOURCE file to 64 MiB when necessary, then hard-link it or copy as fallback. Any failure is swallowed so inline preview remains usable. Source truncation precedes linking, despite comments describing copying first.

### 12. Hints, images, data (765–823)

Log command/indexing metrics, strip empty lines, extract/strip Claude hint tags unconditionally, and record recommendations only for root. Detect/resize image output; failed parse/resize classification falls back to text. Return output, reset-cwd stderr, semantic note, silent-command hint, background cause, sandbox override, and persistence metadata. Terminal truncation checks stdout/stderr.

### 13. Generator contract and exec (825–909)

runShellCommand yields progress and returns ExecResult. Choose timeout with timeout || default (no local maximum clamp), initialize latest output counters and a wakeable progress promise, derive auto-background eligibility, and await exec(command, signal, bash, options). onProgress snapshots output/counts and wakes the generator; exec chooses provider, sandbox, cwd handling, and ShellCommand ownership.

### 14. Task transfer helpers (911–967)

spawnBackgroundTask wraps the existing ShellCommand using its TaskOutput ID and shared state setter. startBackgrounding converts an already registered foreground task in place, avoiding duplicate registration/cleanup events; otherwise asynchronously spawns a wrapper, stores its ID, wakes the progress race, and invokes optional timeout continuation. It does not spawn the command a second time.

### 15. Timeout/assistant/explicit background (969–1009)

Register an onTimeout callback only when eligible. The KAIROS root 15-second unref timer is a separate condition and does not consult the sleep eligibility helper. Explicit background is honored for any command type when enabled and returns synthetic code-zero, noninterrupted output with task ID. That result means work continues.

### 16. Initial wait and progress lifecycle (1011–1050)

Race process completion against a two-second unref timer. Fast completion cleans ShellCommand and returns immediately. Already backgrounded returns its handle. Otherwise start TaskOutput polling; each loop races process result against the poller-driven wake signal.

### 17. Completion/background race (1052–1095)

If a completed result still has backgroundTaskId, mark the task notified, strip that ID, restore large-output file metadata when applicable, clean the shell, and return a completed result. Normal foreground completion unregisters its foreground entry then cleans. This avoids returning a running label and redundant completion notice after the process already exited.

### 18. Running background/progress return (1097–1143)

If backgroundShellId is set, return handle; if foreground task status became backgrounded via Ctrl+B, return manual-background metadata. Otherwise register foreground task once when eligible/UI available, show BackgroundHint, and yield output/timing/counts. finally stops polling. Background ShellCommand cleanup belongs to LocalShellTask; this generator’s finally itself only stops polling.

## End-to-end sequence

```mermaid
sequenceDiagram
    participant Q as Parent query
    participant E as Tool executor
    participant T as BashTool
    participant D as ShellCommand / TaskOutput / LocalShellTask
    Q->>E: tool_use(name, input, id)
    E->>E: Parse input, validate, run hooks and authorization
    alt Execution permitted
        E->>T: call(approved input, context)
        alt Internal approved sed preview
            T->>D: Snapshot/write approved file content, update editor/read state
        else Shell execution
            T->>D: exec(command, signal, bash, sandbox/cwd/timeout options)
            D-->>T: ShellCommand and result promise
            alt Explicit background
                T->>D: spawnShellTask around existing command
                T->>T: Return running task ID
            else Foreground wait
                loop Until completion or task transfer
                    D-->>T: Poller output/progress or process completion
                    T-->>E: Yield bash_progress
                    opt Timeout, assistant budget, or user backgrounds command
                        T->>D: Register/convert task, transfer lifecycle ownership
                    end
                end
                T->>D: Stop foreground polling, cleanup only when foreground completes
            end
            T->>T: Interpret result, throw semantic/pre-spawn failures
            opt Large completed output
                T->>D: Cap raw file, hard-link/copy result artifact
            end
            T->>T: Strip hints, resize image if needed, build result
        end
        Note over Q,D: Background completion, notification, and cleanup happen later in LocalShellTask.
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

## Background completion sequence

The initial tool result can precede process completion. [`LocalShellTask.tsx`](../../../../../tasks/LocalShellTask/LocalShellTask.tsx) owns the later result handler, output flush, status update, and notification deduplication. Notification delivery remains subject to the owning session or agent consuming its queue.

```mermaid
sequenceDiagram
    participant T as BashTool
    participant L as LocalShellTask
    participant S as ShellCommand / TaskOutput
    participant A as Shared task state
    participant N as Pending notifications
    participant Q as Owning session or agent query
    T->>L: Spawn wrapper or transfer foreground command
    L->>A: Register wrapper or locate existing foreground task
    L->>S: Background existing command and attach result handler
    L->>A: Record background ownership where needed
    L-->>T: Task ID
    T-->>Q: Initial tool result with task ID
    Note over L,S: Command continues independently of initial tool call.
    S-->>L: Process result settles later
    L->>S: Flush output and cleanup shell
    L->>A: Preserve killed status or record completed/failed and exit code
    L->>L: Release registered cleanup where applicable
    L->>A: Atomically check and set notified flag
    alt Already notified by another observation path
        L->>L: Suppress duplicate completion notification
    else First notification
        L->>N: Enqueue task-notification with ID, output path, status
        N-->>Q: Deliver when owning query consumes pending notifications
    end
    L->>L: Schedule output eviction where applicable
```

## State, failure, and cancellation boundaries

ShellCommand receives the abort signal: ordinary abort kills, while reason interrupt is intentionally ignored by its low-level handler so a caller can transfer ownership. This Bash generator contains no explicit interrupt-to-background branch; avoid assuming parity with PowerShell. Timeout can background or terminate depending on eligibility/callback. background() removes foreground listeners/timeouts and keeps a size watchdog or disk spill path. LocalShellTask later flushes/cleans, updates terminal status, and queues notification. A returned task ID is not command completion. Persisted size can exceed retained bytes after the 64-MiB cap, and hard linking shares the capped inode.

## Related design

[Permission pipeline](./permissions.md), [path validation](./path-validation.md), [security parsing](./security.md), [read-only analysis](./read-only-validation.md), and [sed validation](./sed-validation.md) expand the delegated guards.
