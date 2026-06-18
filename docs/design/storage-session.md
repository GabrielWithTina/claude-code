# Session Storage Design

## Purpose

Claude Code stores conversation history as append-only JSONL transcripts under
the Claude config directory. Runtime UI state is richer and process-local, while
the JSONL transcript is the durable source for resume, branch/fork, session
listing, file rewind, attribution restore, subagent restore, and remote
session replay.

This document describes the storage model using both source code and a concrete
sample session:

```text
/home/xiaos/.claude/projects/-home-xiaos-git-gabriel-python/
  cd51bba4-3e67-4577-9a9c-1293e0100eff.jsonl
  cd51bba4-3e67-4577-9a9c-1293e0100eff/
    subagents/
    tool-results/
```

The sample main transcript is 515 JSONL lines and about 1.1 MB. Its session
directory contains 28 subagent transcript files, 28 subagent metadata sidecars,
and 3 persisted tool-result blobs.

---

## Source Map

| Path                              | Role                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `types/logs.ts`                   | Type union for persisted session entries: transcript messages, titles, summaries, snapshots, worktree state, compaction state.    |
| `utils/sessionStorage.ts`         | Main writer/reader for local JSONL transcripts, subagent transcripts, remote-agent metadata, resume log views, and deduplication. |
| `utils/sessionStoragePortable.ts` | Shared portable helpers: path sanitization, lite head/tail reads, session file scanning.                                          |
| `utils/messages.ts`               | Internal message constructors used before persistence.                                                                            |
| `utils/toolResultStorage.ts`      | Persisted content-replacement records and tool-result budget reconstruction.                                                      |
| `utils/fileHistory.ts`            | File-history backup blobs and restore state.                                                                                      |
| `state/AppStateStore.ts`          | Process-local UI/runtime state. Most of this is not persisted directly.                                                           |
| `utils/messageQueueManager.ts`    | Runtime command queue and `queue-operation` transcript entries.                                                                   |

Recovered-source caveat: this checkout imports `src/types/message.js` and
`types/messageQueueTypes.js`, but their TypeScript source files are not present.
The persisted shapes below are therefore derived from `types/logs.ts`,
`utils/sessionStorage.ts`, and the sample JSONL.

---

## Storage Layers

```mermaid
flowchart TD
    Runtime["Runtime state\nAppState + Message[] + command queue"]
    Session["Main session JSONL\n<projectDir>/<sessionId>.jsonl"]
    Subagents["Subagent JSONL\n<projectDir>/<sessionId>/subagents/"]
    Sidecars["Sidecars\nremote-agents, tool-results, file-history"]
    Derived["Derived views\nLogOption, SDK events, resume chains"]

    Runtime -->|"recordTranscript / appendEntry"| Session
    Runtime -->|"recordSidechainTranscript"| Subagents
    Runtime -->|"tool result offload / metadata"| Sidecars
    Session -->|"loadTranscriptFile"| Derived
    Subagents -->|"loadSubagentTranscripts"| Derived
    Sidecars -->|"restore helpers"| Derived
```

### Runtime State

The REPL keeps a process-local `AppState` and active `Message[]`.

`AppState` includes task state, MCP state, plugin state, file history,
attribution, todos, notifications, bridge status, prompt suggestions, active
overlays, and other UI/runtime fields. It is not serialized wholesale. Only
selected state is projected to transcript entries or sidecar files.

### Main Session JSONL

**The main session file is append-only JSONL**. Each line is one `Entry` from the
storage union, **usually either a `TranscriptMessage` or a metadata/snapshot
entry.** It is created lazily on the first user or assistant message so
metadata-only startup sessions do not pollute the resume list.

### Subagent Transcripts

Subagents write separate JSONL files under the session directory:

```text
<projectDir>/<sessionId>/subagents/agent-<agentId>.jsonl
<projectDir>/<sessionId>/subagents/agent-<agentId>.meta.json
```

The JSONL entries are the same transcript shape but have `isSidechain: true`
and `agentId`. Metadata sidecars contain the agent type, original task
description, and originating tool-use id.

### Sidecar Stores

Sidecars hold data that should not live inline in the main transcript:

| Directory                                            | Shape          | Purpose                                                              |
| ---------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| `<projectDir>/<sessionId>/tool-results/*.txt`        | text blobs     | Oversized tool results persisted outside the transcript.             |
| `<projectDir>/<sessionId>/remote-agents/*.meta.json` | JSON metadata  | Remote task identity for reconnect/restore.                          |
| `~/.claude/file-history/<sessionId>/...`             | backup files   | Rewind/restore file contents.                                        |
| auto-memory paths                                    | Markdown files | Durable memory, team memory, session memory. Covered in `memory.md`. |

---

## Path Layout

Session project directories are rooted at:

```text
{claudeConfigHome}/projects/
```

`getProjectDir(projectPath)` sanitizes the absolute project path by replacing
non-alphanumeric characters with `-`. Long sanitized names are truncated and
receive a hash suffix.

Example:

```text
project path: /home/xiaos/git/gabriel/python
project dir:  ~/.claude/projects/-home-xiaos-git-gabriel-python
session file: ~/.claude/projects/-home-xiaos-git-gabriel-python/cd51bba4-3e67-4577-9a9c-1293e0100eff.jsonl
```

---

## Main Entry Union

`types/logs.ts` defines the persisted `Entry` union:

```ts
type Entry =
  | TranscriptMessage
  | SummaryMessage
  | CustomTitleMessage
  | AiTitleMessage
  | LastPromptMessage
  | TaskSummaryMessage
  | TagMessage
  | AgentNameMessage
  | AgentColorMessage
  | AgentSettingMessage
  | PRLinkMessage
  | FileHistorySnapshotMessage
  | AttributionSnapshotMessage
  | QueueOperationMessage
  | SpeculationAcceptMessage
  | ModeEntry
  | WorktreeStateEntry
  | ContentReplacementEntry
  | ContextCollapseCommitEntry
  | ContextCollapseSnapshotEntry
```

The sample also contains `permission-mode` metadata entries. That entry type is
observed on disk but is not present in the current recovered `Entry` union,
which indicates source/archive version drift.

---

## Sample Session Inventory

The sample main transcript contains:

| Entry type              | Count |
| ----------------------- | -----:|
| `assistant`             | 223   |
| `user`                  | 125   |
| `system`                | 18    |
| `attachment`            | 12    |
| `file-history-snapshot` | 11    |
| `ai-title`              | 36    |
| `last-prompt`           | 28    |
| `mode`                  | 36    |
| `permission-mode`       | 26    |

Observed system subtypes:

| System subtype  | Count |
| --------------- | -----:|
| `away_summary`  | 6     |
| `local_command` | 5     |
| `turn_duration` | 7     |

Observed content block counts:

| Block                | Count |
| -------------------- | -----:|
| assistant `text`     | 61    |
| assistant `thinking` | 51    |
| assistant `tool_use` | 111   |
| user string content  | 10    |
| user `text`          | 4     |
| user `tool_result`   | 111   |

Observed assistant tool names:

| Tool              | Count |
| ----------------- | -----:|
| `Agent`           | 28    |
| `TaskUpdate`      | 28    |
| `Bash`            | 24    |
| `TaskCreate`      | 15    |
| `AskUserQuestion` | 4     |
| `Skill`           | 4     |
| `Read`            | 3     |
| `Write`           | 2     |
| `Edit`            | 1     |
| `TaskList`        | 1     |
| `ToolSearch`      | 1     |

Subagent inventory:

| Item                          | Count |
| ----------------------------- | -----:|
| Subagent JSONL files          | 28    |
| Subagent metadata files       | 28    |
| Subagent JSONL lines total    | 681   |
| Subagent `assistant` entries  | 381   |
| Subagent `user` entries       | 272   |
| Subagent `attachment` entries | 28    |

---

## TranscriptMessage

`TranscriptMessage` is the durable form of an internal `Message`. The writer
adds parent-chain and session-stamp metadata around the original message.

```ts
type TranscriptMessage = Message & {
  parentUuid: UUID | null
  logicalParentUuid?: UUID | null
  isSidechain: boolean
  cwd: string
  userType: string
  entrypoint?: string
  sessionId: string
  timestamp: string
  version: string
  gitBranch?: string
  slug?: string
  agentId?: string
  teamName?: string
  agentName?: string
  agentColor?: string
  promptId?: string
}
```

### Common Transcript Fields

| Field               | Applies to                    | Meaning                                                                                                    |
| ------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `type`              | all entries                   | **Discriminator. For transcript messages this is usually `user`, `assistant`, `system`, or `attachment`.** |
| `uuid`              | transcript messages           | Unique id for this stored message. Used for parent chains, resume, compaction, snip, and deduplication.    |
| `parentUuid`        | transcript messages           | Previous chain participant. `null` starts a chain or marks a hard boundary such as compact boundary.       |
| `logicalParentUuid` | compact boundaries and breaks | Preserves the logical parent when `parentUuid` is intentionally nullified.                                 |
| `timestamp`         | transcript messages           | ISO timestamp when the message was created or persisted.                                                   |
| `isSidechain`       | transcript messages           | `false` for main session; `true` for subagent transcript entries.                                          |
| `sessionId`         | most entries                  | Session UUID. Main and subagent files in the sample share the parent session id.                           |
| `cwd`               | transcript messages           | Working directory at persistence time.                                                                     |
| `userType`          | transcript messages           | Build/user category, such as `external`.                                                                   |
| `entrypoint`        | transcript messages           | Entry surface, such as `cli`, SDK, or another launcher.                                                    |
| `version`           | transcript messages           | Claude Code version that wrote the entry. Sample uses `2.1.161`.                                           |
| `gitBranch`         | transcript messages           | Best-effort current Git branch at write time.                                                              |
| `slug`              | transcript messages           | Optional session slug used by plan files/resume-related artifacts. Not present in the sample.              |
| `agentId`           | sidechain entries             | Subagent id when entry belongs to a sidechain transcript.                                                  |
| `teamName`          | sidechain/team entries        | Team/swarm name when applicable.                                                                           |
| `agentName`         | sidechain/team entries        | Human-readable agent name when applicable.                                                                 |
| `agentColor`        | sidechain/team entries        | UI color assigned to an agent when applicable.                                                             |
| `promptId`          | user entries                  | Correlates user prompt messages with telemetry/OTel prompt id.                                             |

Parent-chain behavior:

- `recordTranscript()` deduplicates by `uuid` before writing.
- `insertMessageChain()` assigns `parentUuid` sequentially.
- Tool-result user messages may override the sequential parent with
  `sourceToolAssistantUUID` so they attach to the assistant tool-use message.
- `buildConversationChain()` reconstructs the active transcript by walking
  `parentUuid` backward from a leaf.

---

## User Transcript Entries

User entries wrap an Anthropic-style user message:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "..."
  }
}
```

or:

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_...",
        "content": "..."
      }
    ]
  }
}
```

### User Fields

| Field                     | Meaning                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `message.role`            | Always `user` for user transcript entries.                                                                             |
| `message.content`         | Either a string, content block array, or tool-result block array.                                                      |
| `isMeta`                  | Marks synthetic/system-generated user content, such as local command caveats or context reminders.                     |
| `permissionMode`          | Permission mode active when the user message was sent. Used for rewind/restoration.                                    |
| `promptSource`            | Source of the user prompt, observed as `typed` in the sample.                                                          |
| `sourceToolAssistantUUID` | UUID of the assistant message containing the matching `tool_use`; used for tool-result parent linkage.                 |
| `sourceToolUseID`         | Tool-use id that produced the user/tool-result message. Observed in sample for some tool results.                      |
| `toolUseResult`           | Full structured tool output object retained for SDK/UI/replay. The LLM usually sees only `message.content` projection. |

### Tool Result Fields

| Field                                                               | Meaning                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `message.content[].type`                                            | `tool_result`.                                                   |
| `message.content[].tool_use_id`                                     | Matches an assistant `tool_use.id`.                              |
| `message.content[].content`                                         | Model-visible tool result content. May be string or block array. |
| `message.content[].is_error`                                        | Optional error marker for failed/cancelled tools.                |
| `toolUseResult.success`                                             | Tool-specific structured success flag.                           |
| `toolUseResult.commandName`                                         | Skill/local command name for `Skill` tool results.               |
| `toolUseResult.task`, `taskId`, `statusChange`                      | Task-tool structured data.                                       |
| `toolUseResult.agentId`, `agentType`, `usage`, `toolStats`          | Agent tool result metadata for spawned subagents.                |
| `toolUseResult.stdout`, `stderr`, `interrupted`                     | Bash/tool execution details.                                     |
| `toolUseResult.file`, `filePath`, `originalFile`, `structuredPatch` | Read/edit/write tool data.                                       |

`toolUseResult` is intentionally tool-specific and open-ended. It is not a
stable LLM/API payload; it is retained for UI, SDK, resume, and richer replay.

---

## Assistant Transcript Entries

Assistant entries wrap the Anthropic assistant response object:

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_...",
    "type": "message",
    "role": "assistant",
    "model": "claude-opus-4-8",
    "content": [
      { "type": "tool_use", "id": "toolu_...", "name": "Bash", "input": {} }
    ],
    "stop_reason": "tool_use",
    "usage": {}
  },
  "requestId": "req_..."
}
```

### Assistant Fields

| Field                   | Meaning                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `message.id`            | Anthropic message id.                                                                    |
| `message.type`          | Anthropic response object type, usually `message`.                                       |
| `message.role`          | Always `assistant`.                                                                      |
| `message.model`         | Model that produced this assistant response.                                             |
| `message.content`       | Array of assistant blocks such as `text`, `thinking`, and `tool_use`.                    |
| `message.stop_reason`   | Why the model stopped. Sample values: `tool_use`, `end_turn`.                            |
| `message.stop_sequence` | Stop sequence if one was hit; null in the sample.                                        |
| `message.stop_details`  | Provider stop details; null in the sample.                                               |
| `message.diagnostics`   | Optional provider diagnostics. Sample includes `cache_miss_reason`.                      |
| `message.usage`         | Token/cache/server-tool usage for the response.                                          |
| `requestId`             | API request id associated with the response.                                             |
| `attributionPlugin`     | Plugin attribution stamped onto the assistant entry. Sample commonly uses `superpowers`. |
| `attributionSkill`      | Skill attribution stamped onto the assistant entry.                                      |
| `attributionAgent`      | Agent attribution in subagent transcripts.                                               |

- **Attributionxxx means who incurs this assistant transcript message**

### Assistant Content Blocks

| Block      | Fields                                            | Meaning                                                                             |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `text`     | `text`                                            | Human-visible assistant text.                                                       |
| `thinking` | `thinking`, signature-related fields when present | Extended-thinking content. Must obey API thinking rules on replay.                  |
| `tool_use` | `id`, `name`, `input`                             | Model request to invoke a Claude Code tool. Paired with a later user `tool_result`. |

---

## System Transcript Entries

System transcript entries are local Claude Code events, not Anthropic system
prompt messages.

Observed sample subtypes:

| Subtype         | Fields                                 | Meaning                                                              |
| --------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `local_command` | `content`, `level`, `isMeta`           | Local slash/command output or metadata persisted for context/replay. |
| `turn_duration` | `durationMs`, `messageCount`, `isMeta` | Per-turn timing and message-count metric.                            |
| `away_summary`  | `content`, `isMeta`                    | Away/idle summary shown to the user.                                 |

Common fields:

| Field          | Meaning                                                 |
| -------------- | ------------------------------------------------------- |
| `subtype`      | Specific system event discriminator.                    |
| `content`      | Human-readable text or XML-tagged local command output. |
| `level`        | UI severity, such as `info`.                            |
| `durationMs`   | Turn duration for `turn_duration`.                      |
| `messageCount` | Number of messages included in a turn-duration metric.  |
| `isMeta`       | Whether this is metadata-style local event.             |

**Most system transcript entries are filtered before the LLM/API request. Some,
such as local command output, can be converted into user messages during API
normalization when the model should retain that context.**

---

## Attachment Transcript Entries

Attachments persist selected non-chat artifacts. In storage terminology,
`attachment` is a real transcript message type: `isTranscriptMessage()` includes
`user`, `assistant`, `attachment`, and `system`, so attachments receive `uuid`,
`parentUuid`, timestamps, session stamps, and participate in the stored parent
chain.

They are not sent to the LLM/API as an Anthropic `role: "attachment"` message.
Before an API request, the message normalizer handles `type: "attachment"` by
calling `normalizeAttachmentForAPI(attachment)`. That function returns zero or
more internal `UserMessage` objects. **Those generated user messages are usually
`isMeta: true` and wrapped as `<system-reminder>` context.** If the previous
normalized message is already a user message, Claude Code merges the
attachment-derived user content into that previous user message; otherwise it
pushes the generated user messages into the API message sequence.

```text
stored attachment transcript message
  -> normalizeAttachmentForAPI(attachment)
  -> [] or UserMessage[]
  -> merge into previous user message when possible
  -> Anthropic API sees user-role context, not attachment-role context
```

**So attachments are best understood as durable context-injection records. They
let resume/API preparation reconstruct local context that was not literally
typed by the user: hook output, selected IDE text, opened files, skill listings,
task reminders, deferred tool availability, memory snippets, file references,
and similar environment/context events.**

The sample has 12 attachment entries with these observed attachment types:

| Attachment type           | Meaning                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `hook_success`            | Hook execution result, including hook name, event, command, stdout/stderr, exit code, duration. |
| `hook_additional_context` | Additional context returned by a hook.                                                          |
| `skill_listing`           | Snapshot of skills available through the `Skill` tool.                                          |
| `command_permissions`     | Local command permission metadata.                                                              |
| `task_reminder`           | Reminder/context for task-tracking tools.                                                       |
| `deferred_tools_delta`    | Delta of deferred tools made available or removed for `ToolSearch`.                             |

Observed attachment fields:

| Field                                                              | Meaning                                           |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| `attachment.type`                                                  | Attachment discriminator.                         |
| `attachment.hookName`                                              | Hook name for hook-related attachments.           |
| `attachment.toolUseID`                                             | Related tool-use id or hook identifier.           |
| `attachment.hookEvent`                                             | Hook lifecycle event, such as `SessionStart`.     |
| `attachment.content`                                               | Text or block content attached to the transcript. |
| `attachment.stdout`, `stderr`, `exitCode`, `command`, `durationMs` | Hook execution details.                           |
| `attachment.allowedTools`, `pendingMcpServers`                     | Context about tools/MCP availability.             |
| `attachment.names`, `addedNames`, `removedNames`, `readdedNames`   | Skill/tool/context name lists.                    |
| `attachment.itemCount`, `skillCount`, `isInitial`                  | Count and initialization metadata.                |

### Attachment API Normalization

**Attachment normalization is type-specific. Some attachment types become
model-visible user-role context; others intentionally disappear by returning
`[]`.**

For the sample attachment types:

| Attachment type           | API normalization behavior                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hook_success`            | Converts to a meta user reminder only for `SessionStart` or `UserPromptSubmit` hooks with non-empty `content`; otherwise returns `[]`.                 |
| `hook_additional_context` | Converts non-empty hook context to a meta user reminder. **(Typical once in lifecycle)**                                                               |
| `skill_listing`           | Converts non-empty skill listing content to a meta user reminder that lists skills available through the `Skill` tool. **(Typical once in lifecycle)** |
| `command_permissions`     | Returns `[]`; persisted as local/UI permission context but not sent to the LLM.                                                                        |
| `task_reminder`           | Converts to a meta user reminder only when TodoV2 is enabled; otherwise returns `[]`.                                                                  |
| `deferred_tools_delta`    | Converts added/removed deferred tool lines to a meta user reminder about `ToolSearch` availability.                                                    |

Other attachment families follow the same pattern:

| Attachment family                  | API normalization behavior                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File and directory attachments     | Preloaded context from `@` mentions, attachment extraction, and similar user-provided references. Convert to synthetic tool-use/tool-result style user context, often wrapped as system reminders. |
| IDE attachments                    | Preloaded context from IDE selection/open-file state. Convert selected/opened IDE context to meta user reminders.                                                                                  |
| Memory and skill attachments       | Convert relevant memory or invoked-skill contents to meta user reminders, unless the type is UI-only.                                                                                              |
| Plan/auto-mode attachments         | Convert mode instructions or mode-exit notices to meta user reminders.                                                                                                                             |
| Legacy or UI-only attachment types | Return `[]` so old/resumed sessions do not break API normalization and irrelevant UI state is not sent.                                                                                            |

File/directory attachments are different from normal model-requested `Read` or
`Bash` tool calls. A `file` or `directory` attachment means Claude Code
preloaded context before or around the turn, such as an `@`-mentioned file,
directory mention, IDE selection, or opened-file context. The model later sees
that preloaded context as user-role metadata, but the source row remains an
`attachment` transcript entry.

When inputting `@file/directory` in a user input, a subsequent content block with `role: user/system` are generated including the content of the file by using `Read` tool. In real case, it might be incorporated into
the previous user message if appliable. (**IMHO, I would put it in a separate content block as it indeeds a
part of user input). Here are the sample content block:

> Called the Read tool with the following input: {\"file_path\":\"/home/xiaos/git/gabriel/python/forward-proxy/src/forward_proxy/main.py\"}
Result of calling the Read tool:...

In the sample session, there are no `file`, `directory`,
`compact_file_reference`, `pdf_reference`, `edited_text_file`,
`selected_lines_in_ide`, or `opened_file_in_ide` attachment entries. The project
was still heavily inspected, but through explicit tool calls: 61 `Read` tool
uses and 176 `Bash` tool uses across the main session and subagent transcripts.

### Skill Listing Refresh Semantics

`skill_listing` is an announcement snapshot, not the runtime source of truth for
skills. Once written to JSONL, the entry is immutable like every other transcript
row. If skills are added or reloaded later in the same running session, Claude
Code does not patch the old `skill_listing` entry. It updates runtime caches and
may append a later `skill_listing` attachment for newly unsent skills.

```text
skill files change or plugin reload
  -> clear skill/command caches
  -> reset sentSkillNames()
  -> next attachment pass calls getSkillToolCommands(cwd)
  -> append a new skill_listing attachment if there are newly unsent skills
```

The key process-local state is `sentSkillNames`, keyed by agent id. It prevents
the same skill listing from being injected every turn. `resetSentSkillNames()` is
called when the skill set genuinely changes, such as plugin reload or skill file
change on disk, so new or changed skills can be announced again on a later turn.

The `Skill` tool does not depend on the old `skill_listing` attachment to resolve
skills. At invocation time, the tool checks the current runtime command registry
through command lookup. Therefore a newly loaded skill can be callable even if an
old transcript only contains the original `skill_listing` snapshot.

Resume has one extra optimization: if the recovered transcript already contains a
`skill_listing`, the next full listing may be suppressed to avoid re-injecting a
large repeated context block. In that case, skills added between processes may
not be announced immediately in model-visible context, but the runtime Skill
tool registry can still resolve them.

Plain-English model:

```text
skill_listing attachment = append-only model-facing announcement
Skill tool registry       = live source of truth for invocation
sentSkillNames            = process-local dedupe for announcements
```

Persistence rule: `progress` is never loggable, and most attachments are
filtered for external users. Hook additional context can be retained when the
corresponding environment gate is enabled.

---

## Metadata Entries

### `ai-title`

This is used for session title by calling a haiku model for fast generation.

```json
{
  "type": "ai-title",
  "aiTitle": "Create FastAPI language reference guide server",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

| Field       | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `aiTitle`   | Generated title. Lower priority than a user `custom-title`. |
| `sessionId` | Session this title belongs to.                              |

### `last-prompt`

```json
{
  "type": "last-prompt",
  "lastPrompt": "Create a FastAPI based server app...",
  "leafUuid": "2e9935ae-99d4-4168-8492-578b7d4fb323",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

| Field        | Meaning                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lastPrompt` | Truncated recent prompt for resume/ps display.                                                                                     |
| `leafUuid`   | Observed sample field linking the prompt to a leaf message. Present on disk but not in current recovered `LastPromptMessage` type. |
| `sessionId`  | Session this metadata belongs to.                                                                                                  |

### `mode`

```json
{ "type": "mode", "mode": "normal", "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff" }
```

| Field       | Meaning                                          |
| ----------- | ------------------------------------------------ |
| `mode`      | Session mode, usually `normal` or `coordinator`. |
| `sessionId` | Session this mode belongs to.                    |

### `permission-mode`

```json
{
  "type": "permission-mode",
  "permissionMode": "bypassPermissions",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

| Field            | Meaning                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `permissionMode` | Permission mode persisted for session restore/display. Sample uses `bypassPermissions`. |
| `sessionId`      | Session this metadata belongs to.                                                       |

This entry is observed in the sample but not present in the current recovered
`types/logs.ts` `Entry` union.

---

## File History Snapshot Entries

`file-history-snapshot` entries connect the transcript to backup files under
`~/.claude/file-history/<sessionId>/`. **The purpose of this layer is to give the
session transcript enough file-state checkpoints for rewind/restore workflows:**
the JSONL records which logical snapshot was active at a message boundary, while
the file-history directory stores the copied file contents only when a concrete
backup blob exists.

The file history layer is not a full filesystem journal. It tracks files that
pass through file-history-aware mutation paths, then records point-in-time
snapshots of those tracked paths. `fileHistoryTrackEdit()` is called before a
tracked add/edit so the previous contents can be captured or the missing-file
state can be recorded. `fileHistoryMakeSnapshot()` is called at prompt/message
boundaries and backs up tracked files again only when their contents changed.
`createBackup()` writes a physical blob only when the source file exists; if the
file is missing, the snapshot records `backupFileName: null` instead.

### File-History-Aware Mutation Tools

The practical coverage boundary is the set of code paths that call
`fileHistoryTrackEdit()`. A tool that reads files, shells out, or writes files by
some other route is not automatically covered.

| Tool/path                               | File-history behavior                                                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FileWriteTool`                         | Covered. Calls `fileHistoryTrackEdit()` before writing so the pre-write state is captured.                                                                                                                        |
| `FileEditTool`                          | Covered. Calls `fileHistoryTrackEdit()` before applying the edit so the pre-edit state is captured.                                                                                                               |
| `NotebookEditTool`                      | Covered. Calls `fileHistoryTrackEdit()` before notebook mutation.                                                                                                                                                 |
| `BashTool` internal `_simulatedSedEdit` | Covered only for this internal path. Claude Code applies the precomputed sed edit itself and tracks the file before writing.                                                                                      |
| Normal `BashTool` command execution     | Not covered. Commands such as `rm`, `mv`, `python script.py`, `sed -i`, `git checkout`, or heredoc writes can change the filesystem without entering file history.                                                |
| `FileReadTool`                          | Not covered as a mutation source. It updates `readFileState` with file content and timestamps for stale-write checks, but it does not create file-history backups.                                                |
| Subagent tool calls                     | Normally not covered in the parent file history. Subagent contexts use a no-op `updateFileHistoryState`, so even file-aware mutation tools inside a subagent do not update the parent session's tracked file set. |
| Other tools                             | Not covered unless they explicitly route through one of the file-history-aware mutation paths above.                                                                                                              |

`readFileState` and file history are separate layers. `readFileState` remembers
what content was read and when, which lets edit/write tools detect stale writes.
File history stores pre-mutation backups and snapshot metadata for rewind.

### Snapshot Generation Timing

There are two kinds of `file-history-snapshot` entries in the JSONL:

| Entry kind                                | Trigger                                                                                                                                                                       | JSONL behavior                                                                                  | State behavior                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Base snapshot, `isSnapshotUpdate: false`  | **A selectable/restorable parent user message is processed**. The prompt-submit paths call `fileHistoryMakeSnapshot()` for messages that pass `selectableUserMessagesFilter`. | Appends a `file-history-snapshot` entry whose `messageId` is the user message UUID.             | Adds a new snapshot to `fileHistory.snapshots`.                                                             |
| Update snapshot, `isSnapshotUpdate: true` | **A file-history-aware mutation tool calls `fileHistoryTrackEdit()` during the current turn**, before mutating a file not yet tracked in the latest snapshot.                 | Appends a new `file-history-snapshot` entry. It does not edit the previous JSONL line in place. | Replaces the most recent in-memory snapshot with an updated copy that includes the new tracked file backup. |

The base snapshot call sites are:

| Path                                    | Timing                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `screens/REPL.tsx` initial message path | Creates the initial code-rewind checkpoint for the first REPL message.                        |
| `utils/handlePromptSubmit.ts`           | Creates checkpoints for selectable user messages produced from interactive prompt submission. |
| `QueryEngine.ts`                        | Creates checkpoints for selectable user messages in persisted non-interactive sessions.       |

The important distinction is that snapshot anchoring is by message UUID, not by
nearby JSONL line position. Snapshot persistence and transcript message
persistence are separate append operations, so a base snapshot line can appear
before the user message line it references. In the sample session, line 2 points
to the `/clear` user message at line 6, and line 8 points to the typed prompt at
line 9. The reliable relationship is:

```text
file-history-snapshot.messageId == target user message uuid
```

Update entries have two message ids with different meanings:

```json
{
  "type": "file-history-snapshot",
  "messageId": "assistant-tool-use-message-uuid",
  "snapshot": {
    "messageId": "original-user-message-uuid",
    "trackedFileBackups": {}
  },
  "isSnapshotUpdate": true
}
```

| Field                 | Meaning for update entries                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Top-level `messageId` | The message that caused the update, usually the assistant message containing the file-writing tool use. |
| `snapshot.messageId`  | The original base snapshot being updated, usually the current turn's restorable user message.           |
| `isSnapshotUpdate`    | Tells restore/loading code to fold this appended JSONL entry over the earlier base snapshot.            |

On resume, `buildFileHistorySnapshotChain()` reconstructs the effective snapshot
chain. For each `file-history-snapshot` entry, it looks up the entry by the
conversation message UUID. A base entry pushes a new snapshot. An update entry
finds the existing snapshot by `snapshot.messageId` and replaces that snapshot
in the reconstructed array. The JSONL remains append-only; the replacement only
happens in reconstructed state.

In the sample session, the split is:

| Count | Meaning                                                                                     |
| ----- | ------------------------------------------------------------------------------------------- |
| 9     | Base snapshots for selectable/restorable parent user messages.                              |
| 2     | Update snapshots from parent-thread `Write` tool calls.                                     |
| 11    | Total `file-history-snapshot` JSONL entries.                                                |
| 2     | Physical backup blobs, because only two tracked files ever needed concrete content backups. |

**The resulting lifecycle is:**

```text
Restorable parent user message
  -> append base file-history-snapshot metadata anchored by user UUID

File-history-aware mutation during that turn
  -> replace latest snapshot in memory
  -> append isSnapshotUpdate:true JSONL entry anchored by the tool-use message

Later restorable parent user message
  -> append new base snapshot, carrying forward tracked file backup state
```

```json
{
  "type": "file-history-snapshot",
  "messageId": "aa6082e8-5581-4370-8e81-d22d43d57eae",
  "snapshot": {
    "messageId": "aa6082e8-5581-4370-8e81-d22d43d57eae",
    "trackedFileBackups": {
      "docs/superpowers/specs/2026-06-03-lang-reference-guide-design.md": {
        "backupFileName": "0123456789abcdef@v1",
        "version": 1,
        "backupTime": "2026-06-03T09:15:03.641Z"
      }
    },
    "timestamp": "2026-06-03T09:15:03.641Z"
  },
  "isSnapshotUpdate": false
}
```

| Field                         | Meaning                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `messageId`                   | Message UUID associated with the file-history state.                                      |
| `snapshot.messageId`          | Same logical snapshot anchor.                                                             |
| `snapshot.trackedFileBackups` | Map of tracked path -> backup metadata.                                                   |
| `backupFileName`              | Blob filename under `~/.claude/file-history/<sessionId>/`; null means file did not exist. |
| `version`                     | Per-file backup version.                                                                  |
| `backupTime`                  | Backup creation time.                                                                     |
| `snapshot.timestamp`          | Snapshot timestamp.                                                                       |
| `isSnapshotUpdate`            | Whether this line updates an earlier snapshot.                                            |

### Observed Session Behavior

For sample session
`/home/xiaos/.claude/projects/-home-xiaos-git-gabriel-python/cd51bba4-3e67-4577-9a9c-1293e0100eff.jsonl`,
the main transcript contains 11 `file-history-snapshot` entries, but the
corresponding file-history directory contains only two physical backup blobs:

```text
~/.claude/file-history/cd51bba4-3e67-4577-9a9c-1293e0100eff/
  407d6e14c9eed3f5@v2
  da8c25ed54b72cc4@v2
```

That is expected for this session:

| Observation                                                                     | Explanation                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Early snapshots have no files.                                                  | `fileHistoryMakeSnapshot()` can record a message-boundary snapshot before any file is tracked.                                                                                |
| The first tracked version for each new file has `backupFileName: null`.         | The relevant `Write` created a new file, so the pre-edit state was "file did not exist"; `createBackup()` records a null marker instead of creating an `@v1` blob.            |
| The only physical blobs are `@v2`.                                              | The next snapshot after each new file existed copied the concrete file contents into the file-history directory.                                                              |
| Later snapshots keep referencing the same two `@v2` blobs.                      | Once a tracked file is unchanged, `fileHistoryMakeSnapshot()` reuses the latest backup metadata instead of creating another blob.                                             |
| Many subagent-written files do not appear in the parent file-history directory. | Subagent contexts use a no-op `updateFileHistoryState`, so their file mutations are stored in subagent transcripts but do not update the parent session's file-history state. |
| Normal shell operations do not automatically create file-history blobs.         | Only file-history-aware mutation paths call `fileHistoryTrackEdit()`; Bash only participates for the internal simulated-sed edit path.                                        |

The two observed blobs map to the two parent-thread tracked files:

| Backup blob           | Tracked path                                                       |
| --------------------- | ------------------------------------------------------------------ |
| `da8c25ed54b72cc4@v2` | `docs/superpowers/specs/2026-06-03-lang-reference-guide-design.md` |
| `407d6e14c9eed3f5@v2` | `docs/superpowers/plans/2026-06-03-lang-reference-guide.md`        |

So the answer to "why only two files" is: this session only tracked two
parent-thread files through file-history-aware mutations, both were new files,
their `v1` states were null "did not exist" markers inside the JSONL, and their
first physical contents were captured as `@v2` blobs.

### Rewind Scope and Success Semantics

File-history rewind is a scoped restore operation, not a whole-workspace
rollback. `fileHistoryRewind()` finds the target snapshot by message id and
calls `applySnapshot()`. `applySnapshot()` only iterates over
`state.trackedFiles`; any path outside that set is not diffed, deleted, restored,
or reported as changed.

That means subagent-created files are normally outside the rewind scope:

| File origin                                                              | Rewind behavior                                                                                                       |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Parent-thread file tracked by `fileHistoryTrackEdit()`                   | Restored or deleted according to the selected parent snapshot.                                                        |
| Parent-thread new file whose target snapshot says `backupFileName: null` | Deleted if it exists at rewind time.                                                                                  |
| File created or edited only by a subagent                                | Left untouched because subagents do not add paths to the parent `trackedFiles` set.                                   |
| File created by a subagent and later edited by the parent thread         | Rewind can affect it only from the point where the parent thread first tracked it.                                    |
| Git-tracked file created only by a subagent                              | Still left untouched by file-history rewind; git status may show it, but file history does not use git to restore it. |

The success signal is scoped the same way. The implementation logs
`tengu_file_history_rewind_success` after `applySnapshot()` completes and reports
`trackedFilesCount` plus `filesChangedCount`. It does not check whether every
filesystem side effect from the original conversation was undone.

So a rewind can be successful by Claude Code's current definition while still
leaving subagent-created files in the workspace. It is successful if the
conversation was rewound and the selected file-history snapshot was applied to
the parent session's tracked files. It is not a complete guarantee that the
working tree matches the checkpoint exactly.

---

## UUID Parent Tree

Transcript entries with `uuid` and `parentUuid` are organized as a parent graph,
not as a physical linked list of JSONL rows. In normal one-message-at-a-time
turns the graph often looks list-like, but the storage contract is:

```text
child.parentUuid == parent.uuid
```

The reliable relationship is the UUID edge, not adjacency in the JSONL file.
Metadata entries without a transcript `uuid`, such as `mode`, `ai-title`,
`permission-mode`, `last-prompt`, and `file-history-snapshot`, are side metadata
and are not conversation graph nodes.

### Observed Shape

For the sample session, the parent graph is a tree per transcript file:

| Scope                          | Observed result                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Main transcript                | 378 UUID-bearing nodes, 1 root, no missing parents, no cycles, no unreachable nodes. |
| Main fan-out                   | 39 parent nodes have more than one child; the maximum observed child count is 2.     |
| Main row adjacency             | 87 parent links do not point to the immediately previous UUID-bearing JSONL row.     |
| Subagent transcripts           | 28 JSONL files, each with 1 root and no missing parents or cycles.                   |
| Subagent fan-out               | 22 of 28 subagent files have at least one parent with more than one child.           |
| Whole inspected transcript set | Main tree plus 28 subagent trees, which forms a forest across files.                 |

Example fan-out from the main sample:

```text
parent 7b522683-7c3a-4596-a052-e51f297da957
  -> line 24 assistant 21015386-... tool_use:TaskCreate
  -> line 31 user      7c9018a9-... tool_result:toolu_01RTY886mPhqXYC8MukXSMX3
```

This is not a linked list. A linked list would allow only one child per node and
would usually make the previous persisted message the parent. The observed
transcript has sibling branches, and many child entries attach to an earlier
semantic parent rather than the preceding JSONL row.

### Why Store a Tree

Claude Code still sends a linear message sequence to the model, but storage is
append-only and must preserve enough structure to reconstruct the current
conversation after rewinds, interrupts, side effects, and parallel tool output.
The tree gives the loader a stable way to choose the active chain.

| Design pressure             | Why a parent tree helps                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Append-only persistence     | Rewind, ctrl-z, and resumed branches can leave old branches in the JSONL. New entries are appended instead of rewriting the file.                        |
| Active-chain reconstruction | `buildConversationChain()` can find a leaf and walk `parentUuid` back to the root, ignoring orphaned or inactive branches.                               |
| Parallel tool streaming     | Streaming can persist separate assistant entries for parallel `tool_use` blocks. Sibling assistant/tool-result branches may share the same parent.       |
| Tool-result attachment      | A `tool_result` user message can attach to the assistant message that produced its `tool_use`, even when that assistant message is not the previous row. |
| Metadata interleaving       | Non-conversation metadata can be appended between transcript nodes without affecting graph reconstruction.                                               |
| Subagent isolation          | Each subagent file can maintain its own tree while the parent session references the subagent by sidecar metadata and tool-use ids.                      |

The resume path uses this graph to derive the linear view:

```text
append-only JSONL rows
  -> load uuid/parentUuid map
  -> find active leaf
  -> walk parentUuid from leaf to root
  -> reverse into the linear transcript used by UI/model resume
```

There is also a recovery pass for orphaned parallel tool results. The source
comments describe a case where streaming emits one assistant message per
`content_block_stop` for parallel `tool_use` blocks. If a loader only followed a
single linked-list branch, it could keep one sibling and drop the others. The
parent graph plus recovery logic lets Claude Code preserve the semantically
related sibling tool-use/tool-result entries when building the effective
conversation.

### Main Session vs Subagent Trees

The main session file and subagent files do not form one giant tree through
`parentUuid`. A subagent transcript is a sidechain tree stored in its own file.
The relationship back to the parent session is carried by sidechain fields and
metadata:

| Link field/source | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `isSidechain`     | Marks subagent transcript entries.                                 |
| `agentId`         | Groups entries for one subagent sidechain.                         |
| `toolUseId`       | Metadata sidecar field that points to the parent `Agent` tool use. |
| `sessionId`       | Shared parent session id for the main file and subagent files.     |

So the storage model is best understood as:

```text
session directory
  main transcript tree
  subagents/
    agent A transcript tree
    agent B transcript tree
    ...
  sidecars and metadata
```

Plain-English rule: the JSONL file is the append log, `uuid`/`parentUuid` is the
conversation graph, and resume turns the active graph branch back into a linear
conversation.

---

## Subagent Files

Each subagent file is a sidechain transcript. The sample has 28 subagent JSONLs.
Their entries have the same message shape as main transcript entries with these
differences:

| Field         | Difference                                                                     |
| ------------- | ------------------------------------------------------------------------------ |
| `isSidechain` | Always `true` in observed subagent files.                                      |
| `agentId`     | Present on every observed subagent entry.                                      |
| `parentUuid`  | Starts at `null` for the sidechain root, then chains within the subagent file. |
| `sessionId`   | Same parent session id as the main transcript.                                 |

Subagent metadata sidecar sample:

```json
{
  "agentType": "general-purpose",
  "description": "Apply Task 5 review fixes",
  "toolUseId": "toolu_01SSj8Tg72KVrQccrMFgcAv7"
}
```

| Field          | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `agentType`    | Agent definition/type used to launch the subagent.                        |
| `description`  | Original task description, used for resume/UI display.                    |
| `toolUseId`    | Parent assistant tool-use id that spawned the subagent.                   |
| `worktreePath` | Optional isolated worktree path. Not present in observed sample metadata. |

---

## Tool Result Sidecar Files

Tool-result sidecars store oversized tool output outside the JSONL transcript.
The transcript remains the source of conversation structure; the sidecar is only
the full payload backing file.

The sample session has three sidecar blobs:

```text
tool-results/bfnn83qj4.txt 680576 bytes
tool-results/bh5ajgxix.txt 389862 bytes
tool-results/bt6a0wf0e.txt 32946 bytes
```

Observed references in the sample:

| Sidecar file    | Referencing subagent JSONL                | JSONL line | Producing tool |
| --------------- | ----------------------------------------- | ---------- | -------------- |
| `bt6a0wf0e.txt` | `subagents/agent-afcbd3f4a3214735f.jsonl` | `L007`     | `Bash`         |
| `bh5ajgxix.txt` | `subagents/agent-ab23a854385c678eb.jsonl` | `L006`     | `Bash`         |
| `bfnn83qj4.txt` | `subagents/agent-ad83af2dc94669885.jsonl` | `L007`     | `Bash`         |

The main session JSONL has no observed `<persisted-output>` reference. The
sidecar files live under the parent session directory, but the transcript rows
that point at them are inside the subagent sidechain files.

### JSONL Entry Shape

A persisted sidecar is represented in the transcript as a normal `user`
message containing a normal Anthropic `tool_result` block. The `tool_result`
content is replaced with a small XML-ish pointer and preview:

```json
{
  "type": "user",
  "uuid": "05caa05d-bda2-453b-bbac-e293c45757e5",
  "parentUuid": "b8ce5bc2-2fd9-4a47-8425-739d18e76dbc",
  "isSidechain": true,
  "agentId": "afcbd3f4a3214735f",
  "sourceToolAssistantUUID": "b8ce5bc2-2fd9-4a47-8425-739d18e76dbc",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_01LKcgiJZyXNnFssMCHvxAta",
        "is_error": false,
        "content": "<persisted-output>\nOutput too large (32.2KB). Full output saved to: /home/xiaos/.claude/projects/-home-xiaos-git-gabriel-python/cd51bba4-3e67-4577-9a9c-1293e0100eff/tool-results/bt6a0wf0e.txt\n\nPreview (first 2KB):\n...\n</persisted-output>"
      }
    ]
  }
}
```

The previous assistant message is the producing tool call:

```json
{
  "type": "assistant",
  "uuid": "b8ce5bc2-2fd9-4a47-8425-739d18e76dbc",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01LKcgiJZyXNnFssMCHvxAta",
        "name": "Bash"
      }
    ]
  }
}
```

The linkage is therefore:

```text
assistant tool_use
  uuid = b8ce5bc2...
  content[].id = toolu_01LK...

    -> user tool_result
       parentUuid = b8ce5bc2...
       sourceToolAssistantUUID = b8ce5bc2...
       content[].tool_use_id = toolu_01LK...
       content[].content = <persisted-output> sidecar path + preview
```

The sidecar file itself is raw text, not JSON. For `bt6a0wf0e.txt`, the file
begins with the full numbered plan document that the `Bash` command produced.

### Follow-Up Reads

The `<persisted-output>` wrapper gives the model a readable absolute path. If
the model needs more than the preview, it can call `Read` on the sidecar like a
normal file. In the sample `agent-afcbd3f4a3214735f.jsonl`, the subagent reads
`bt6a0wf0e.txt` in chunks:

| JSONL line | Entry type  | Tool action                                         |
| ---------- | ----------- | --------------------------------------------------- |
| `L008`     | `assistant` | `Read` `bt6a0wf0e.txt`, `limit: 120`                |
| `L009`     | `user`      | `tool_result` with lines 1-120                      |
| `L010`     | `assistant` | `Read` `bt6a0wf0e.txt`, `offset: 120`, `limit: 100` |
| `L011`     | `user`      | `tool_result` with that chunk                       |
| `L012`     | `assistant` | `Read` `bt6a0wf0e.txt`, `offset: 220`, `limit: 120` |
| `L013`     | `user`      | `tool_result` with that chunk                       |

Those follow-up rows are ordinary `Read` tool-use/tool-result transcript rows.
They are not special sidecar metadata entries.

### Source Paths and Filename Rules

The common persistence helpers live in `utils/toolResultStorage.ts`:

| Function                                | Role                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `getToolResultsDir()`                   | Resolves `<projectDir>/<sessionId>/tool-results`.                        |
| `getToolResultPath(id, isJson)`         | Builds `<id>.txt` for text results or `<id>.json` for text-block arrays. |
| `persistToolResult(content, toolUseId)` | Writes the full payload and returns path, size, and preview metadata.    |
| `buildLargeToolResultMessage(result)`   | Builds the `<persisted-output>` wrapper.                                 |
| `maybePersistLargeToolResult(...)`      | Replaces oversized `tool_result.content` with the wrapper.               |

For generic tools, the persisted filename is based on the Anthropic
`tool_use_id` passed to `persistToolResult()`. For Bash and PowerShell, large
process output first flows through `TaskOutput`; the shell tool copies or
hard-links the task output file into `tool-results/` using
`getToolResultPath(result.outputTaskId, false)`. That is why the sample's Bash
sidecar is named `bt6a0wf0e.txt` while the transcript's model-facing
`tool_use_id` remains `toolu_01LKcgiJZyXNnFssMCHvxAta`.

The shell task id is generated by `generateTaskId('local_bash')` as a short
case-insensitive id. It is an internal output-file id, not an API message id.

### Relation to Content Replacement

`content-replacement` is a separate transcript metadata entry used by the
aggregate tool-result budget and resume reconstruction machinery. Its shape is:

```json
{
  "type": "content-replacement",
  "sessionId": "...",
  "replacements": [
    {
      "kind": "tool-result",
      "toolUseId": "toolu_...",
      "replacement": "[Large tool result content persisted to disk]"
    }
  ]
}
```

The provided sample has no observed `content-replacement` entries in either the
main transcript or the subagent transcripts. Its sidecar references are encoded
directly in normal `tool_result.content` strings via the `<persisted-output>`
wrapper.

Plain rule:

```text
tool-results/*.txt
  -> full large output payload

user tool_result.content = <persisted-output>...
  -> small model-visible pointer and preview

content-replacement entry
  -> separate resume/budget metadata; not used by this sample's sidecar rows
```

---

## Loading and Derived Views

`loadTranscriptFile()` returns maps, not a raw list:

```ts
{
  messages: Map<UUID, TranscriptMessage>
  summaries: Map<UUID, string>
  customTitles: Map<UUID, string>
  tags: Map<UUID, string>
  agentNames: Map<UUID, string>
  agentColors: Map<UUID, string>
  agentSettings: Map<UUID, string>
  prNumbers: Map<UUID, number>
  modes: Map<UUID, string>
  worktreeStates: Map<UUID, PersistedWorktreeSession | null>
  fileHistorySnapshots: Map<UUID, FileHistorySnapshotMessage>
  attributionSnapshots: Map<UUID, AttributionSnapshotMessage>
  contentReplacements: Map<UUID, ContentReplacementRecord[]>
  agentContentReplacements: Map<AgentId, ContentReplacementRecord[]>
  contextCollapseCommits: ContextCollapseCommitEntry[]
  contextCollapseSnapshot?: ContextCollapseSnapshotEntry
  leafUuids: Set<UUID>
}
```

Then `getLastSessionLog()` builds a `LogOption` by selecting the latest
non-sidechain leaf and walking `parentUuid` back to the root. `LogOption` is a
derived resume/listing view, not a stored record.

Large-file load optimizations:

- Lite listing reads file stats and bounded head/tail windows.
- Full loading can skip pre-compact bytes.
- Attribution snapshots can be skipped during chunked load except for the most
  recent relevant snapshot.
- For large transcripts, a byte-level parent-chain walk can discard dead
  branches before JSON parsing.

---

## Write Rules

| Rule                                                          | Reason                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| Append one JSON object per line.                              | Keeps writes simple and crash-tolerant.                               |
| Create the main session file lazily.                          | Avoid metadata-only sessions in resume.                               |
| Batch queued writes per file.                                 | Avoid frequent small sync writes.                                     |
| Deduplicate transcript messages by `uuid`.                    | Prevent repeated growing-array calls from duplicating entries.        |
| Do not dedup sidechain local writes against the main session. | Sidechains inherit parent UUIDs but need complete separate files.     |
| Re-append tail metadata.                                      | Resume listing reads bounded tail windows.                            |
| Filter progress before persistence.                           | Progress is UI-only and high-frequency.                               |
| Filter most attachments for external users.                   | Avoid leaking sensitive training/debug context.                       |
| Preserve parent chains.                                       | Resume/fork/branch reconstructs conversation by walking `parentUuid`. |

---

## Representative Sanitized Samples

User local-command metadata:

```json
{
  "parentUuid": "4ceb6e2e-959f-4cdd-a14f-dd93ee23883a",
  "isSidechain": false,
  "promptId": "5375361a-0291-4ac4-b4ca-fc5fcbb46f24",
  "type": "user",
  "message": {
    "role": "user",
    "content": "<local-command-caveat>...</local-command-caveat>"
  },
  "isMeta": true,
  "uuid": "dddbd323-6d5d-4fb4-8f3f-9897539a16b2",
  "timestamp": "2026-06-03T09:10:48.540Z",
  "userType": "external",
  "entrypoint": "cli",
  "cwd": "/home/xiaos/git/gabriel/python",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff",
  "version": "2.1.161",
  "gitBranch": "main"
}
```

Assistant tool use:

```json
{
  "parentUuid": "7ac25558-d13a-4542-af25-5a39ff4b7474",
  "isSidechain": false,
  "type": "assistant",
  "message": {
    "id": "msg_...",
    "type": "message",
    "role": "assistant",
    "model": "claude-opus-4-8",
    "content": [
      { "type": "tool_use", "id": "toolu_...", "name": "Skill", "input": { "skill": "..." } }
    ],
    "stop_reason": "tool_use",
    "usage": { "input_tokens": 5604, "output_tokens": 178 }
  },
  "requestId": "req_...",
  "uuid": "5afb77dd-0dd0-49db-b14c-064c108a8603",
  "timestamp": "2026-06-03T09:15:08.734Z",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

User tool result:

```json
{
  "parentUuid": "5afb77dd-0dd0-49db-b14c-064c108a8603",
  "isSidechain": false,
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "tool_use_id": "toolu_...",
        "content": "Launching skill: superpowers:brainstorming"
      }
    ]
  },
  "toolUseResult": {
    "success": true,
    "commandName": "superpowers:brainstorming"
  },
  "sourceToolAssistantUUID": "5afb77dd-0dd0-49db-b14c-064c108a8603",
  "uuid": "2bac8d25-ecec-4703-a15a-7c8fdf101742",
  "timestamp": "2026-06-03T09:15:08.760Z",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

Attachment hook result:

```json
{
  "parentUuid": null,
  "isSidechain": false,
  "type": "attachment",
  "attachment": {
    "type": "hook_success",
    "hookName": "SessionStart",
    "hookEvent": "SessionStart",
    "stdout": "...",
    "stderr": "",
    "exitCode": 0,
    "command": "...",
    "durationMs": 40
  },
  "uuid": "b00a16af-4bca-4f9d-9523-b535e6503764",
  "timestamp": "2026-06-03T09:10:48.539Z",
  "sessionId": "cd51bba4-3e67-4577-9a9c-1293e0100eff"
}
```

---

## Current-State Summary

The storage design is event-log oriented:

```text
Runtime Message[] / AppState
  -> selected, cleaned, stamped entries
  -> append-only JSONL Entry[]
  -> maps + parent-chain reconstruction
  -> LogOption / resume / SDK / UI projections
```

The main JSONL is not just "chat history." It is a mixed append-only log of:

- model-visible transcript messages
- local system and attachment records
- session metadata
- file history snapshots
- tool-result and content-replacement metadata
- compaction metadata
- sidechain/subagent message records

The model-facing prompt is later projected from this richer stored form; it is
not identical to the raw JSONL.
