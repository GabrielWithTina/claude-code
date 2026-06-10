# EnterWorktreeTool Design

`EnterWorktreeTool` moves the current session into an isolated git worktree.
Its prompt says to use it only when the user explicitly asks for a worktree.

## Source Map

| File | Purpose |
|---|---|
| `tools/EnterWorktreeTool/EnterWorktreeTool.ts` | Tool schema, validation, worktree creation, CWD switch, and state updates. |
| `tools/EnterWorktreeTool/prompt.ts` | Model-facing constraints for entering worktrees. |
| `tools/EnterWorktreeTool/UI.tsx` | Tool rendering. |
| `tools/EnterWorktreeTool/constants.ts` | Tool name constant. |

## Lifecycle

The optional `name` input is validated as a worktree slug. The call path rejects
nested current-worktree sessions, creates the worktree, moves the process CWD
and app CWD to the new worktree, records the original CWD, saves worktree state,
and clears prompt, memory, and plans-directory caches.

## State Effects

This tool changes process-level state through `process.chdir()` and updates the
session's cwd/project-root bookkeeping. Downstream file tools therefore operate
inside the worktree after the transition.

