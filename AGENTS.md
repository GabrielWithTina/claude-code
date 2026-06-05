# AGENTS.md

This file gives Codex project-specific guidance for working in this repository.
It supplements the global instructions in `/home/xiaos/.codex/` and the
project overview in `CLAUDE.md`.

## Mandatory Rules

- Do not change any files without explicit user approval.
- Commit messages must not mention Codex or include Codex attribution.
- Treat this repository as a recovered source archive. Preserve original source
  behavior unless the user explicitly asks for a runnable fix or refactor.

## Project Identity

This repository contains recovered Claude Code source. The current checkout is a
TypeScript/TSX codebase that runs through Bun with local runtime shims.

- Runtime: Bun.
- UI: React + Ink terminal rendering.
- API client: Anthropic SDK.
- CLI parsing: Commander.js.
- Entry point for local runs: `entrypoints/cli.tsx`, which imports the main
  application path.

The repo now includes scaffolding files such as `package.json`, `tsconfig.json`,
`bunfig.toml`, and `shims/preload.ts`. Older docs may describe the original
archive as lacking these files; prefer the actual current tree when in doubt.

## First Files To Read

Before making project-level claims, read these in order:

1. `CLAUDE.md` for the high-level module map and subsystem summary.
2. `docs/design/README.md` for the design-document index and architecture
   diagrams.
3. The relevant subsystem document under `docs/design/`:
   - `main.md` for startup and CLI dispatch.
   - `repl.md` for the interactive terminal path.
   - `query-loop.md` for streaming, tool dispatch, and compaction.
   - `query-engine.md` for headless / SDK session lifecycle.
   - `context.md` for system-prompt and user-context assembly.
   - `tool-system.md` and `permissions.md` for tools and permission checks.
   - `commands.md` for slash commands.
   - `mcp.md` for MCP integration.
   - `coordinator.md`, `autodream.md`, and `compaction.md` for specialized
     subsystems.

## Working Style

- Use `rg` / `rg --files` for navigation.
- Keep edits narrowly scoped to the user-approved task.
- Prefer documenting and explaining existing behavior over reshaping it.
- Do not perform broad formatting, import reordering, or cleanup in recovered
  source unless specifically requested.
- Be especially careful around prompt, permission, auth, telemetry, bridge,
  coordinator, and MCP code. These areas have security and behavior impact.
- If docs and source disagree, call out the discrepancy and verify against the
  source before editing.

## Running And Debugging

See `docs/get-started.md` for the current local-run notes.

Useful commands:

```sh
bun run entrypoints/cli.tsx
bun run entrypoints/cli.tsx --debug -p "outline the summary of the current project"
bun --inspect-wait=127.0.0.1:6499/mytoken entrypoints/cli.tsx
```

Notes:

- Real conversations require `ANTHROPIC_API_KEY`.
- `bunfig.toml` loads `shims/preload.ts` before scripts.
- The preload shim handles `bun:bundle` feature checks and unavailable internal
  packages for direct Bun execution.
- Telemetry is disabled by the preload shim for local exploration.

## Verification

- For documentation-only changes, verify the Markdown content is accurate
  against `CLAUDE.md`, `docs/design/`, and the current file tree.
- For code changes, use Bun-oriented verification commands that match the
  touched area. There is no single authoritative test command documented for
  the whole recovered tree.
- If a command cannot be run because credentials or Anthropic infrastructure are
  missing, state that explicitly in the final report.
