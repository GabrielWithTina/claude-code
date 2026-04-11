# Design: Make Claude Code Source Runnable

**Date:** 2026-04-11  
**Approach:** Runtime shim layer (Approach A)  
**Runtime:** Bun (direct TypeScript execution, no bundling step)  
**Auth:** Anthropic API key (`ANTHROPIC_API_KEY`)

---

## Problem Statement

This repository contains the leaked TypeScript source of Claude Code, recovered from npm sourcemaps. It has no `package.json`, no build config, and depends on Bun's compile-time `bun:bundle` module (`feature()` — 960 usages) that doesn't exist at runtime. The goal is to add the minimum scaffolding to run `main.tsx` directly with `bun run` as a working CLI.

---

## What's Missing

| Gap | Impact |
|---|---|
| No `package.json` | No dependencies installable |
| No `tsconfig.json` | `src/*` path aliases unresolved; `.js`→`.ts` resolution broken |
| No `bunfig.toml` | No preload hook; no alias config |
| `bun:bundle` module missing at runtime | 960 `feature()` calls throw on import |
| `@ant/computer-use-*` not on npm | 3 internal packages unresolvable |

---

## Architecture

### 1. Dependency Manifest (`package.json`)

Created at repo root. Declares all public npm dependencies extracted from import scanning across all `.ts`/`.tsx` files. Key dependencies:

- `@anthropic-ai/sdk` — Anthropic API client
- `@anthropic-ai/claude-agent-sdk` — public agent SDK
- `@anthropic-ai/mcpb` — MCP bundle tools (public)
- `@anthropic-ai/sandbox-runtime` — sandbox runtime (public)
- `@commander-js/extra-typings` — CLI argument parsing
- `@growthbook/growthbook` — feature flag runtime
- `@modelcontextprotocol/sdk` — MCP client/server
- `chalk`, `ink`, `react` — terminal UI
- `zod`, `lodash-es`, `execa`, and ~35 other public packages

Set `"type": "module"` to match ESM import style throughout the source.

### 2. `bun:bundle` Shim via Bun Plugin Preload

**`shims/preload.ts`** — registered as Bun preload, executes before `main.tsx`:

```ts
Bun.plugin({
  name: "bun-bundle-shim",
  setup(build) {
    // Shim bun:bundle — all feature flags return false (external build behavior)
    build.module("bun:bundle", () => ({
      exports: { feature: (_flag: string) => false },
      loader: "object",
    }))

    // Stub internal @ant/* packages not available on npm
    for (const pkg of [
      "@ant/computer-use-mcp",
      "@ant/computer-use-input",
      "@ant/computer-use-swift",
    ]) {
      build.module(pkg, () => ({ exports: {}, loader: "object" }))
    }
  },
})
```

With `feature()` returning `false`, all internal feature branches (KAIROS, BUDDY, BRIDGE_MODE, COORDINATOR_MODE, VOICE_MODE, etc.) are disabled at runtime — exactly matching the public npm build.

**`bunfig.toml`** — tells Bun to run the preload before any script:

```toml
preload = ["./shims/preload.ts"]
```

### 3. Path Alias Configuration (`tsconfig.json`)

Two resolution problems solved:

- **`src/*` imports:** ~861 files import `from 'src/utils/foo.js'` but the source root is the repo root. `paths` maps `src/*` → `./*`.
- **`.js` on `.ts` files:** Standard ESM convention; Bun's `"moduleResolution": "bundler"` handles it natively.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "jsx": "react-jsx",
    "paths": {
      "src/*": ["./*"]
    }
  }
}
```

No source files are modified. All resolution is handled by config.

### 4. Entry Point & Run Command

```bash
ANTHROPIC_API_KEY=sk-ant-... bun run main.tsx
```

Convenience scripts in `package.json`:
```json
"scripts": {
  "start": "bun run main.tsx"
}
```

Bun handles the full chain automatically: preload → plugin registration → TypeScript transpilation → `Bun.*` native APIs.

---

## Files to Create

| File | Purpose |
|---|---|
| `package.json` | Dependency manifest |
| `tsconfig.json` | Path aliases + module resolution |
| `bunfig.toml` | Preload registration |
| `shims/preload.ts` | `bun:bundle` + `@ant/*` plugin shims |

No source files are modified.

---

## Known Limitations

| Feature | Status | Reason |
|---|---|---|
| KAIROS, BUDDY, Bridge Mode, Coordinator Mode | Disabled | `feature()` → `false`; requires Anthropic infra |
| Computer Use ("Chicago") | Disabled | `@ant/computer-use-*` stubbed out |
| Auto-updater | No-op | No published package to update from |
| GrowthBook runtime flags | Disabled | Requires Anthropic's GrowthBook endpoint |
| Fast Mode ("Penguin Mode") | Disabled | Requires Anthropic internal endpoint |
| All 40+ tools (Bash, FileEdit, Glob, Web, Agent, etc.) | **Work** | No special infra needed |
| MCP servers | **Work** | `@modelcontextprotocol/sdk` is public |
| Multi-agent (AgentTool) | **Work** | Uses same API key |
| Memory / autoDream | **Work** | Pure filesystem |
| Plugins / Skills | **Work** | Loaded from `~/.claude/plugins/` as normal |
| OAuth login | **Works** | Code present; API key is simpler for now |

---

## Success Criteria

1. `bun install` completes without errors
2. `ANTHROPIC_API_KEY=... bun run main.tsx` launches the interactive REPL
3. A basic prompt ("Hello") returns a response from the Claude API
4. BashTool, FileReadTool, and FileEditTool execute correctly
