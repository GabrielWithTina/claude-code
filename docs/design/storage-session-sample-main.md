# Sample Main Session JSONL Guide

This guide indexes the generated diagrams for the sample main-agent session and
explains how to use them together with `storage-session.md`.

Sample session:

```text
/home/xiaos/.claude/projects/-home-xiaos-git-gabriel-python/
  cd51bba4-3e67-4577-9a9c-1293e0100eff.jsonl
  cd51bba4-3e67-4577-9a9c-1293e0100eff/
    subagents/
    tool-results/
```

The main JSONL has 515 lines:

| Row category                         | Count | Where to inspect |
| ------------------------------------ | ----: | ---------------- |
| UUID-bearing transcript entries      | 378   | Parent tree diagram |
| No-UUID metadata entries             | 137   | Metadata timeline |
| `file-history-snapshot` metadata     | 11    | File-history timeline |
| Subagent transcript files            | 28    | `subagents/` directory |
| Persisted tool-result sidecar blobs  | 3     | `tool-results/` directory |
| Physical file-history backup blobs   | 2     | `~/.claude/file-history/<sessionId>/` |

---

## Diagram Index

| File | Use it for | Shape |
| ---- | ---------- | ----- |
| [`storage-session-sample-main-tree.svg`](./storage-session-sample-main-tree.svg) | Inspecting the `uuid` / `parentUuid` transcript tree. | Rendered Graphviz SVG |
| [`storage-session-sample-main-tree.dot`](./storage-session-sample-main-tree.dot) | Source for the transcript tree diagram. | Graphviz DOT |
| [`storage-session-sample-main-metadata-timeline.svg`](./storage-session-sample-main-metadata-timeline.svg) | Inspecting every no-UUID metadata row without the parent tree noise. | Rendered table SVG |
| [`storage-session-sample-main-metadata-timeline.dot`](./storage-session-sample-main-metadata-timeline.dot) | Source for the metadata timeline. | Graphviz DOT |
| [`storage-session-sample-main-file-history-timeline.svg`](./storage-session-sample-main-file-history-timeline.svg) | Understanding file-history snapshot generation and tracked backup state. | Rendered table SVG |
| [`storage-session-sample-main-file-history-timeline.dot`](./storage-session-sample-main-file-history-timeline.dot) | Source for the readable file-history timeline. | Graphviz DOT |
| [`storage-session-sample-main-file-history-map.svg`](./storage-session-sample-main-file-history-map.svg) | Seeing file-history snapshot references as edges. Useful for verifying links, less useful for reading. | Rendered Graphviz SVG |
| [`storage-session-sample-main-file-history-map.dot`](./storage-session-sample-main-file-history-map.dot) | Source for the file-history edge map. | Graphviz DOT |

The removed full append-log graph tried to draw physical append order,
transcript parent edges, file-history references, and `last-prompt` references
in one graph. It was technically faithful but visually unreadable for this
session size, so the diagrams are split by relationship type.

---

## Recommended Reading Order

1. Read `storage-session.md` for the durable storage model, entry fields, and
   source-code control flow.
2. Open the parent tree diagram to understand the transcript graph.
3. Open the metadata timeline to inspect rows that do not have `uuid` /
   `parentUuid`.
4. Open the file-history timeline to understand why the JSONL has 11
   file-history entries but only two physical backup blobs.
5. Use the raw JSONL only after identifying the line range or UUID from one of
   the diagrams.

---

## Tool-Result Sidecars

The sample has three persisted tool-result payloads under the parent session
directory:

```text
cd51bba4-3e67-4577-9a9c-1293e0100eff/
  tool-results/
    bfnn83qj4.txt
    bh5ajgxix.txt
    bt6a0wf0e.txt
```

The main JSONL does not contain `<persisted-output>` references for these
files. The references are in the subagent sidechain transcripts:

| Sidecar file | Size | Referencing subagent JSONL | JSONL line | Producing tool |
| ------------ | ---: | -------------------------- | ---------- | -------------- |
| `bt6a0wf0e.txt` | 32946 bytes | `subagents/agent-afcbd3f4a3214735f.jsonl` | `L007` | `Bash` |
| `bh5ajgxix.txt` | 389862 bytes | `subagents/agent-ab23a854385c678eb.jsonl` | `L006` | `Bash` |
| `bfnn83qj4.txt` | 680576 bytes | `subagents/agent-ad83af2dc94669885.jsonl` | `L007` | `Bash` |

The sidecar reference row is a normal `user` transcript message with a
`tool_result` content block. Its `content` is a `<persisted-output>` wrapper
containing the absolute sidecar path plus a preview, not the full output.

For `bt6a0wf0e.txt`, the surrounding subagent rows show the full pattern:

| JSONL line | Entry | Meaning |
| ---------- | ----- | ------- |
| `L005` | assistant `tool_use: Bash` | Produces `toolu_01LKcgiJZyXNnFssMCHvxAta`. |
| `L007` | user `tool_result` | Links to that `tool_use_id` and replaces content with the sidecar pointer. |
| `L008`-`L013` | assistant/user `Read` pairs | The subagent reads the sidecar file back in chunks. |

This is different from no-UUID metadata rows such as `file-history-snapshot` or
`content-replacement`. In this sample there are no `content-replacement` rows;
the sidecar pointers are embedded directly inside ordinary transcript messages.

---

## Parent Tree Diagram

The parent tree diagram contains only transcript entries with `uuid` and
`parentUuid`.

It answers:

| Question | How to read the diagram |
| -------- | ----------------------- |
| What is the transcript root? | The only node with `parentUuid: null`; in the sample it is line `L003`. |
| Which nodes are leaves? | Red double-bordered nodes marked `LEAF`. |
| Where does fan-out happen? | A parent node with multiple outgoing blue parent edges. |
| Why is this not a linked list? | Several nodes have sibling children, and many parent links do not point to the previous physical JSONL line. |

Key sample observations:

| Metric | Value |
| ------ | ----: |
| UUID-bearing transcript nodes | 378 |
| Parent edges | 377 |
| Roots | 1 |
| Leaves | 40 |
| Parent nodes with multiple children | 39 |
| Missing parents | 0 |
| Unreachable nodes from root | 0 |

What it omits:

- `mode`
- `ai-title`
- `last-prompt`
- `permission-mode`
- `file-history-snapshot`

Those rows are metadata, not transcript graph nodes.

---

## Metadata Timeline

The metadata timeline contains every no-UUID row from the main JSONL. These
rows are append-log metadata and do not participate directly in `parentUuid`
tree traversal.

It answers:

| Question | Where to look |
| -------- | ------------- |
| Which no-UUID row types exist? | Summary table at the top. |
| Which line records the current mode? | `mode` table. |
| Which lines record permission mode? | `permission-mode` table. |
| Which generated titles were persisted? | `ai-title` table. |
| Which prompt text was attached to which leaf? | `last-prompt` table. |
| Which file-history snapshot points at which message? | `file-history-snapshot` table. |

Observed no-UUID rows:

| Metadata type | Count | Main target field |
| ------------- | ----: | ----------------- |
| `file-history-snapshot` | 11 | `messageId`, plus `snapshot.messageId` for updates |
| `last-prompt` | 28 | `leafUuid` |
| `ai-title` | 36 | Session-level title state |
| `mode` | 36 | Session-level mode state |
| `permission-mode` | 26 | Session-level permission state |

Important distinction:

```text
uuid / parentUuid rows
  -> transcript graph

no-UUID metadata rows
  -> append-log state and annotations
```

---

## File-History Timeline

The file-history timeline is the most readable view for rewind-related
questions. It is a table with one row per `file-history-snapshot`.

It answers:

| Question | Where to look |
| -------- | ------------- |
| Why are there 11 JSONL snapshot rows? | One row per persisted file-history snapshot entry. |
| Which snapshots are base checkpoints? | `Entry kind = base`. |
| Which snapshots update an earlier base checkpoint? | `Entry kind = update`; sample has `L096` and `L135`. |
| Which user message is the base snapshot anchored to? | `snapshot.messageId target`. |
| Which tool-use caused an update snapshot? | `messageId target` on update rows. |
| Why are there only two physical backup blobs? | `Tracked backup state` column. |

The two update rows are the critical part:

| JSONL line | Cause | Base snapshot updated | Effect |
| ---------- | ----- | --------------------- | ------ |
| `L096` | `L095` assistant `Write` | `L086` user prompt | Adds spec file with `backupFileName: null`, version 1. |
| `L135` | `L134` assistant `Write` | `L117` user prompt | Adds plan file with `backupFileName: null`, version 1. |

The later base checkpoints capture concrete file contents:

| Blob | Meaning |
| ---- | ------- |
| `da8c25ed54b72cc4@v2` | Physical backup for the spec/design file. |
| `407d6e14c9eed3f5@v2` | Physical backup for the plan file. |

Rule of thumb: JSONL snapshot entries record logical file-history state, while
physical blobs are created only when a tracked path exists and needs a concrete
content backup.

---

## Relationship To `storage-session.md`

Use this guide as a visual index. Use `storage-session.md` for the field
catalog and implementation behavior.

| Topic | Primary doc |
| ----- | ----------- |
| Entry union and persisted fields | `storage-session.md` |
| Parent tree semantics | `storage-session.md` + parent tree diagram |
| No-UUID metadata rows | `storage-session.md` + metadata timeline |
| File-history snapshot timing | `storage-session.md` + file-history timeline |
| Subagent storage | `storage-session.md`; subagent files are not diagrammed here |
| Tool-result sidecars | `storage-session.md`; sidecar blobs are not diagrammed here |

Plain-English model:

```text
main JSONL append log
  transcript rows        -> uuid/parentUuid tree
  no-UUID metadata rows  -> session annotations and state snapshots
  sidecar directories    -> large outputs, subagents, file-history blobs
```

The diagrams split those relationships because a single all-in-one graph is
harder to read than the source JSONL.
