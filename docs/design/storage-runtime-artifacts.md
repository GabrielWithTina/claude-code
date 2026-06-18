# Runtime Artifact Storage

## Purpose

Runtime artifact storage covers durable or semi-durable files that are not
settings, memory, plugin metadata, or canonical conversation transcripts. These
files support prompt recall, live session discovery, TodoV2 coordination,
scheduled prompts, large pasted content, image persistence, task output, stats,
policy cache, warning state, and release-note caches.

Most of these stores are either append-only logs, small JSON files, or opaque
blobs. They are not sent directly to the LLM. Runtime code reads them and
projects selected information into UI state, messages, or tool results.

---

## Source Map

| Source | Role |
|---|---|
| `history.ts` | Global prompt history JSONL and pasted-content references. |
| `utils/pasteStore.ts` | Large pasted text content-addressed cache. |
| `utils/imageStore.ts` | Pasted image storage and per-process image id map. |
| `utils/concurrentSessions.ts` | Live session PID registry under `~/.claude/sessions`. |
| `utils/tasks.ts` | TodoV2 task JSON files, locks, high-watermark, dependency updates. |
| `hooks/useTasksV2.ts` | TodoV2 file watch and UI refresh store. |
| `utils/cronTasks.ts` | Durable scheduled prompt file shape. |
| `utils/cronTasksLock.ts` | Scheduled task lock file. |
| `utils/task/diskOutput.ts` | Background task output files under the project temp dir. |
| `utils/toolResultStorage.ts` | Large tool-result sidecars under session directories. |
| `utils/mcpOutputStorage.ts` | Binary MCP output persistence into tool-result directories. |
| `utils/fileHistory.ts` | File backup blobs under `~/.claude/file-history`. |
| `utils/statsCache.ts` | Bounded aggregated stats cache. |
| `services/policyLimits/index.ts` | Cached policy limit file. |
| `utils/releaseNotes.ts` | Cached changelog under `~/.claude/cache/changelog.md`. |

---

## Prompt History

Path:

```text
~/.claude/history.jsonl
```

Observed sample:

```text
lines: 2457
size: 829086 bytes
entry shape: { display, pastedContents, timestamp, project, sessionId }
```

Entry shape:

```json
{
  "display": "user prompt with [Pasted text #1] placeholder",
  "pastedContents": {
    "1": {
      "id": 1,
      "type": "text",
      "contentHash": "0123456789abcdef",
      "mediaType": "text/plain",
      "filename": "notes.txt"
    }
  },
  "timestamp": 1781488560773,
  "project": "/home/user/repo",
  "sessionId": "11111111-1111-4111-8111-111111111111"
}
```

Fields:

| Field | Meaning |
|---|---|
| `display` | Prompt text shown in prompt history. Large pasted text and images are represented by placeholders. |
| `pastedContents` | Map from numeric paste id to stored paste metadata. Images are filtered out because image bytes are stored separately. |
| `pastedContents[].content` | Inline text for small pastes up to 1024 characters. |
| `pastedContents[].contentHash` | Hash reference for large pasted text stored in `paste-cache`. |
| `timestamp` | Epoch milliseconds. |
| `project` | Project root used to filter history for the current project. |
| `sessionId` | Session id that recorded the prompt. |

Write behavior:

- Pending entries are buffered in memory.
- Flush uses append-only JSONL with a lock on `history.jsonl`.
- Readers scan newest-first and skip malformed lines.
- Current-session entries are prioritized for up-arrow history.
- Prompt-history removal can skip already-flushed entries through a
  session-local timestamp skip set.

## Paste Cache

Path:

```text
~/.claude/paste-cache/<sha256-prefix>.txt
```

Source-defined sample:

```text
~/.claude/paste-cache/0123456789abcdef.txt
```

Rules:

| Rule | Meaning |
|---|---|
| Hash | First 16 hex characters of SHA-256 over pasted text. |
| Storage | Plain UTF-8 text, mode `0600` for new files. |
| Reference | `history.jsonl.pastedContents[].contentHash`. |
| Cleanup | Time-based cleanup removes `.txt` files older than a cutoff date. |

## Image Cache

Path shape:

```text
~/.claude/image-cache/<sessionId>/<image-id>.<extension>
```

Source behavior:

- Images pasted or dragged into the terminal are written outside prompt history.
- An in-memory map tracks paste id to stored image path for the current process.
- Cleanup removes old image cache directories from previous sessions.
- Prompt history stores image placeholders such as `[Image #2]`, not image
  bytes.

Synthetic sample:

```json
{
  "id": 2,
  "type": "image",
  "mediaType": "image/png",
  "filename": "diagram.png",
  "dimensions": {
    "width": 1200,
    "height": 800
  },
  "sourcePath": "/home/user/Desktop/diagram.png"
}
```

## Live Session Registry

Path:

```text
~/.claude/sessions/<pid>.json
```

Observed sample shape:

```json
{
  "pid": 154084,
  "sessionId": "11111111-1111-4111-8111-111111111111",
  "cwd": "/home/user/repo",
  "startedAt": 1780477490442,
  "procStart": "1234567",
  "version": "2.1.161",
  "peerProtocol": 1,
  "kind": "interactive",
  "entrypoint": "cli",
  "status": "idle",
  "updatedAt": 1780477490370
}
```

Fields:

| Field | Meaning |
|---|---|
| `pid` | Process id that owns the registry file. |
| `sessionId` | Current session id. Updated on resume/session switch. |
| `cwd` | Original working directory. |
| `startedAt` | Epoch milliseconds when registered. |
| `kind` | Session kind: `interactive`, `bg`, `daemon`, or `daemon-worker`. |
| `entrypoint` | Entry surface, such as `cli`, SDK, or desktop. |
| `name`, `logPath`, `agent` | Optional background-session fields. |
| `messagingSocketPath` | Optional UDS inbox socket path when that feature is enabled. |
| `bridgeSessionId` | Optional remote-control bridge id. |
| `status` | Live activity status: `busy`, `idle`, or `waiting`. |
| `waitingFor` | Optional description of what the session is waiting for. |
| `updatedAt` | Epoch milliseconds for last activity update. |

Rules:

- Top-level sessions register themselves; teammates/subagents skip registry
  writes to avoid polluting `claude ps`.
- Cleanup removes the file on process exit.
- Stale files can be swept if the PID is no longer running. WSL is conservative
  because Windows-native PIDs may not be probeable.

## TodoV2 Task Storage

Path:

```text
~/.claude/tasks/<task-list-id>/
  .lock
  .highwatermark
  <task-id>.json
```

Observed sample task:

```json
{
  "id": "27",
  "subject": "Apply review fixes",
  "description": "Implement the requested changes...",
  "activeForm": "Applying review fixes",
  "status": "pending",
  "blocks": [],
  "blockedBy": []
}
```

Task fields:

| Field | Meaning |
|---|---|
| `id` | Task id within the task list. |
| `subject` | Short task label. |
| `description` | Longer task description. |
| `activeForm` | Present-tense text for spinner/status UI. |
| `owner` | Optional agent id that claimed the task. |
| `status` | `pending`, `in_progress`, or `completed`. |
| `blocks` | Task ids blocked by this task. |
| `blockedBy` | Task ids that block this task. |
| `metadata` | Optional task-specific metadata. |

Task-list id resolution:

```text
CLAUDE_CODE_TASK_LIST_ID
  > in-process teammate team name
  > CLAUDE_CODE_TEAM_NAME
  > leader team name
  > session id
```

Rules:

- Path components are sanitized to letters, numbers, hyphens, and underscores.
- Task creation and reset lock the task-list `.lock` file.
- Task updates lock the individual task file after confirming it exists.
- `.highwatermark` prevents id reuse after deletion or reset.
- Dependency updates write both `blocks` and `blockedBy`.
- UI refresh combines `fs.watch`, in-process notifications, debounce, and a
  fallback poll while incomplete tasks exist.

The existing deeper task document is
[tools/planning-todos-worktrees/tasktools/task-storage.md](./tools/planning-todos-worktrees/tasktools/task-storage.md).

## Scheduled Tasks

Path:

```text
<project>/.claude/scheduled_tasks.json
<project>/.claude/scheduled_tasks.lock
```

No concrete `scheduled_tasks.json` was observed in the targeted sample set.
Source-defined shape:

```json
{
  "tasks": [
    {
      "id": "morning-checkin",
      "cron": "0 9 * * 1-5",
      "prompt": "Review open work and prepare a short update.",
      "createdAt": 1781488560000,
      "lastFiredAt": 1781574960000,
      "recurring": true,
      "permanent": true
    }
  ]
}
```

Fields:

| Field | Meaning |
|---|---|
| `id` | Scheduled task id. |
| `cron` | Five-field cron string in local time. Validated on read/write. |
| `prompt` | Prompt to enqueue when the task fires. |
| `createdAt` | Epoch milliseconds when created. |
| `lastFiredAt` | Epoch milliseconds of most recent fire. Used to reconstruct next run after restart. |
| `recurring` | If true, task survives after firing and reschedules. |
| `permanent` | System escape hatch for built-in assistant-mode tasks that should not auto-expire. |

Runtime-only fields:

| Field | Meaning |
|---|---|
| `durable` | If false, task lives only in process memory and is never written. |
| `agentId` | Session-only teammate route for task fires. |

Rules:

- Missing, empty, malformed, or invalid-cron files load as an empty task list.
- Invalid individual tasks are skipped so one bad record does not block the file.
- One-shot durable tasks are deleted after firing.
- Recurring tasks update `lastFiredAt`.
- Durable tasks survive process restart; session-only tasks do not.

## Background Task Output

Path shape:

```text
<project-temp-dir>/<sessionId>/tasks/<taskId>.output
```

Rules:

- Session id is captured on first call so `/clear` does not strand existing
  background task output paths.
- Output append uses a flat in-memory queue and a single drain loop to avoid
  retaining every chunk in chained promises.
- Unix opens use `O_NOFOLLOW` to avoid symlink attacks from sandboxed paths.
- Disk cap is 5 GB. Further chunks are dropped and a truncation marker is
  appended.
- Readers can tail or read ranges rather than loading the whole file.

## Tool Result And MCP Output Sidecars

Tool result sidecars are covered in [storage-session.md](./storage-session.md).
Runtime artifact storage includes them because several non-session modules write
into the same sidecar directory.

Path:

```text
~/.claude/projects/<project>/<sessionId>/tool-results/<id>.<ext>
```

Text tool result shape:

```text
tool-results/bfnn83qj4.txt
```

Binary MCP output synthetic sample:

```text
tool-results/mcp-output-1234.pdf
```

Rules:

- Large textual tool results can be replaced in model-visible content with a
  persisted-output message.
- `ContentReplacementRecord` entries preserve the exact replacement string that
  the model saw.
- Binary MCP output writes raw bytes with a MIME-derived extension such as
  `pdf`, `json`, `csv`, `png`, or `bin`.
- The returned tool result tells the model where the file was saved.

## File History Backups

Path:

```text
~/.claude/file-history/<sessionId>/<hash>@vN
```

Observed sample:

```text
~/.claude/file-history/cd51bba4-.../da8c25ed54b72cc4@v2
~/.claude/file-history/cd51bba4-.../407d6e14c9eed3f5@v2
```

Rules:

- Backup blob bytes live in `file-history`, not in session JSONL.
- Session JSONL stores `file-history-snapshot` entries pointing at backup
  filenames and versions.
- A `null` backup filename means the original file did not exist.
- Rewind/restore reads backup blobs by snapshot chain.

## Stats Cache

Path:

```text
~/.claude/stats-cache.json
```

Observed shape:

```json
{
  "version": 4,
  "lastComputedDate": "2026-06-15",
  "dailyActivity": [
    {
      "date": "2026-06-15",
      "messageCount": 12,
      "sessionCount": 2,
      "toolCallCount": 5
    }
  ],
  "dailyModelTokens": [],
  "modelUsage": {},
  "totalSessions": 102,
  "totalMessages": 9155,
  "longestSession": null,
  "firstSessionDate": "2026-05-01T00:00:00.000Z",
  "hourCounts": {
    "9": 12
  },
  "totalSpeculationTimeSavedMs": 0
}
```

Rules:

- Cache is bounded by aggregate fields, not raw per-message history.
- Load validates version and required aggregate arrays/numbers.
- Migratable old versions are rewritten to the current format.
- Save uses temp-file plus rename to avoid partial-write corruption.

## Policy And Warning State

Observed files:

```text
~/.claude/policy-limits.json
~/.claude/security_warnings_state_<uuid>.json
```

`policy-limits.json` shape:

```json
{
  "restrictions": {
    "allow_remote_sessions": true,
    "allow_remote_control": false,
    "allow_routines": true
  },
  "compliance_taints": []
}
```

`security_warnings_state_<uuid>.json` observed shape was a small object whose
numeric keys map to strings. It records local acknowledgement state for warning
flows, not conversation history.

## Release And Misc Caches

Observed files:

```text
~/.claude/cache/changelog.md
~/.claude/cache/my-closed-issues.json
~/.claude/.last-update-result.json
```

`cache/changelog.md` is cached release-note content. The global config keeps a
`changelogLastFetched` timestamp for migration/support, while content lives in
the cache file.

`.last-update-result.json` observed shape:

```json
{
  "timestamp": "2026-06-15T00:00:00.000Z",
  "path": "global",
  "outcome": "success",
  "status": "latest",
  "version_from": "2.1.160",
  "version_to": "2.1.161",
  "error_code": null
}
```

These files are cache/status state. They can affect UX, but they are not
canonical transcript, settings, or memory stores.

## Design Notes

- Prompt history and session transcripts are both JSONL, but they serve
  different products: recall/search versus resume/replay.
- PID session files are liveness state. They are expected to disappear and can
  be swept when stale.
- Task JSON files are coordination state and can be shared across agents or
  processes.
- Blob stores keep large data out of JSONL and config files, while transcript
  or history records keep stable references.
- Cache files are intentionally recoverable. If they disappear, Claude Code can
  recompute or refetch them.
