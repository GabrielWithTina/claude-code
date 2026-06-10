# ExitWorktreeTool Design

`ExitWorktreeTool` returns the current session from an isolated worktree to the
original working directory. It can either keep the worktree on disk or remove
it.

## Source Map

| File | Purpose |
|---|---|
| `tools/ExitWorktreeTool/ExitWorktreeTool.ts` | Tool schema, validation, dirty-worktree checks, restore logic, and cleanup. |
| `tools/ExitWorktreeTool/prompt.ts` | Model-facing exit guidance. |
| `tools/ExitWorktreeTool/UI.tsx` | Tool rendering. |
| `tools/ExitWorktreeTool/constants.ts` | Tool name constant. |

## Inputs

`action` is either `keep` or `remove`. `discard_changes` is required to remove a
worktree that has uncommitted changes or unmerged commits.

## Safety Model

The tool only acts on the active worktree session. Removing a worktree is marked
destructive. Without `discard_changes: true`, the tool counts changed files and
commits and refuses removal if any work may be lost. If change detection cannot
be completed, it fails closed.

## State Effects

The restore path resets process CWD, app CWD, original CWD, project root, hook
snapshots, worktree state, and relevant caches.

