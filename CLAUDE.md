# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is the leaked source code of the Claude Code CLI, recovered from npm sourcemap files (`.map`) bundled with the published package. It is a **source-only archive** — there is no `package.json`, `Makefile`, or build toolchain present. The original project uses **Bun** as its bundler and runtime.

## Language and Runtime

- TypeScript/TSX throughout
- React + [Ink](https://github.com/vadimdemedes/ink) for terminal UI rendering
- Bun runtime (`bun:bundle` feature flags, `bun:test` for tests in the original project)
- Anthropic SDK (`@anthropic-ai/sdk`) for all API calls
- Commander.js for CLI argument parsing

## Architecture Overview

### Entry Point

`main.tsx` is the monolithic entry point (~785KB). It handles CLI argument parsing, auth, startup prefetching (MDM, keychain, GrowthBook), and launches either the interactive REPL or a non-interactive agent run.

### Core Conversation Loop

- `QueryEngine.ts` — orchestrates the full agent loop: sends messages, handles tool use, manages compaction, and emits SDK events
- `query.ts` — lower-level API call logic; constructs requests to the Anthropic API
- `context.ts` / `context/` — builds the system prompt and user context (git status, CLAUDE.md files, memory files)

### Tool System

- `Tool.ts` — base types: `Tool`, `Tools`, `ToolUseContext`, `PermissionResult`
- `tools.ts` — registry: `getTools()` / `getAllBaseTools()` assemble the active tool list, gated by feature flags and `USER_TYPE`
- `tools/` — one subdirectory per tool (e.g., `tools/BashTool/`, `tools/FileEditTool/`)

### UI Layer

- `screens/REPL.tsx` — main interactive terminal screen
- `screens/ResumeConversation.tsx` — conversation resume UI
- `hooks/` — ~80 React hooks covering input handling, keybindings, IDE integration, voice, task management, etc.
- `state/AppState.tsx` + `state/AppStateStore.ts` — global app state via a store pattern
- `ink.ts` — Ink renderer setup

### Commands (Slash Commands)

- `commands.ts` — command registry and `getSlashCommandToolSkills()`
- `commands/` — one subdirectory per slash command

### Services

- `services/api/` — Claude API client, rate limiting, logging, usage tracking
- `services/mcp/` — MCP server management and connections
- `services/analytics/` — GrowthBook feature flags (runtime), telemetry
- `services/autoDream/` — background memory consolidation engine (see below)
- `services/oauth/` — OAuth flow
- `services/lsp/` — Language Server Protocol integration

### Constants and System Prompts

- `constants/prompts.ts` — core system prompt sections
- `constants/systemPromptSections.ts` — modular, cacheable prompt sections; split at `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`
- `constants/betas.ts` — all beta API headers negotiated at runtime
- `constants/cyberRiskInstruction.ts` — security boundary instructions (owned by Safeguards team; do not modify without review)

### Feature Gating

Two mechanisms:
1. **Compile-time** (`bun:bundle` `feature()` calls) — dead-code-eliminated from external builds. Key flags: `PROACTIVE`/`KAIROS`, `BUDDY`, `BRIDGE_MODE`, `COORDINATOR_MODE`, `TRANSCRIPT_CLASSIFIER`, `VOICE_MODE`, `DAEMON`
2. **Runtime** (GrowthBook, `tengu_*` prefixed flags) — cached via `getFeatureValue_CACHED_MAY_BE_STALE()`; stale reads are intentional on the hot path

`USER_TYPE === 'ant'` gates internal-only tools (`REPLTool`, `ConfigTool`, `TungstenTool`), staging API, Undercover mode, and debug prompt dumping.

## Key Subsystems

### Memory / autoDream (`services/autoDream/`, `memdir/`)

A background subagent that runs a four-phase memory consolidation pass (Orient → Gather → Consolidate → Prune). Triggered by a three-gate system: 24h elapsed + 5 sessions + consolidation lock. The subagent gets read-only bash access and writes to the memory directory (`memdir/`).

### Multi-Agent Coordinator (`coordinator/`)

Activated via `CLAUDE_CODE_COORDINATOR_MODE=1`. Transforms the single agent into a coordinator that spawns parallel worker agents through Research → Synthesis → Implementation → Verification phases.

### Bridge Mode (`bridge/`)

JWT-authenticated integration with claude.ai. Supports `single-session`, `worktree`, and `same-dir` work modes. Includes trusted device tokens for elevated security tiers.

### Undercover Mode (`utils/undercover.ts`)

Injected for `USER_TYPE === 'ant'` on public repos. Prevents AI from leaking internal codenames, unreleased model versions, or Anthropic attribution in commits/PRs. Activates automatically unless the remote matches an internal allowlist; no force-off path exists.

### KAIROS (`assistant/`)

Always-on proactive assistant mode (feature flag `KAIROS`). Runs on `<tick>` intervals with a 15-second blocking budget. Has exclusive tools: `SendUserFileTool`, `PushNotificationTool`, `SubscribePRTool`.

### BUDDY (`buddy/`)

Tamagotchi-style companion pet. Deterministic gacha via Mulberry32 PRNG seeded from `userId` + salt `'friend-2026-401'`. 18 species across 5 rarity tiers; 1% independent shiny chance. Species names are obfuscated via `String.fromCharCode()` arrays.

### Permission System (`tools/permissions/`)

Permission modes: `default` (interactive), `auto` (ML classifier), `bypass`, `yolo`. Risk levels: LOW / MEDIUM / HIGH. YOLO classifier is the ML auto-approval path. Protected files (`.gitconfig`, `.zshrc`, `.mcp.json`, etc.) are guarded from automatic edits.
