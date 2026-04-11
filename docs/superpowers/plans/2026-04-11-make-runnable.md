# Make Claude Code Source Runnable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the minimum scaffolding (4 files) so `bun run main.tsx` launches a working Claude Code REPL against an Anthropic API key.

**Architecture:** A Bun plugin preload shims `bun:bundle` (returning `false` for all feature flags) and stubs 4 internal `@ant/*` packages; `tsconfig.json` provides `src/*` path alias and routes `color-diff-napi` to its vendored TypeScript port; `package.json` declares all public npm dependencies; `bunfig.toml` wires the preload in. Zero source files are modified.

**Tech Stack:** Bun (runtime + package manager), TypeScript, `bun run` (no bundling step)

---

## Files to Create

| File | Purpose |
|---|---|
| `shims/preload.ts` | Bun plugin: shims `bun:bundle` + stubs `@ant/*` packages |
| `bunfig.toml` | Registers preload; runs before `main.tsx` |
| `tsconfig.json` | `src/*` alias, `color-diff-napi` alias, `.js`→`.ts` resolution |
| `package.json` | All public npm dependencies |

No existing source files are modified.

---

## Task 1: Create the Bun plugin preload

**Files:**
- Create: `shims/preload.ts`

- [ ] **Step 1: Create `shims/preload.ts`**

```ts
// shims/preload.ts
// Runs before main.tsx via bunfig.toml preload.
// Shims compile-time Bun modules and internal @ant/* packages that are not on npm.

Bun.plugin({
  name: 'bun-bundle-shim',
  setup(build) {
    // bun:bundle provides feature() at bundle/compile time only.
    // At runtime (bun run), it doesn't exist. We shim it with all flags = false,
    // which matches the behavior of the public npm release build.
    build.module('bun:bundle', () => ({
      exports: { feature: (_flag: string) => false },
      loader: 'object',
    }))

    // Internal @ant/* packages are not published to npm.
    // They gate Computer Use ("Chicago") and Chrome integration — both require
    // Anthropic-internal infrastructure and Max/Pro subscriptions regardless.
    const antStubs = [
      '@ant/computer-use-mcp',
      '@ant/computer-use-input',
      '@ant/computer-use-swift',
      '@ant/claude-for-chrome-mcp',
    ]
    for (const pkg of antStubs) {
      build.module(pkg, () => ({ exports: {}, loader: 'object' }))
    }
  },
})
```

- [ ] **Step 2: Verify the file exists**

```bash
ls shims/preload.ts
```
Expected output: `shims/preload.ts`

- [ ] **Step 3: Commit**

```bash
git add shims/preload.ts
git commit -m "feat: add bun:bundle + @ant/* shim preload"
```

---

## Task 2: Create `bunfig.toml`

**Files:**
- Create: `bunfig.toml`

- [ ] **Step 1: Create `bunfig.toml`**

```toml
# bunfig.toml
# Registers shims/preload.ts so it runs before any script (including main.tsx).
# Bun loads this file automatically from the project root.
preload = ["./shims/preload.ts"]
```

- [ ] **Step 2: Commit**

```bash
git add bunfig.toml
git commit -m "feat: add bunfig.toml with preload registration"
```

---

## Task 3: Create `tsconfig.json`

**Files:**
- Create: `tsconfig.json`

The three jobs this file does:
1. `"src/*": ["./*"]` — maps `src/foo` imports to the repo root (the source root IS the repo root, not a `src/` subdirectory)
2. `"color-diff-napi": ["./native-ts/color-diff/index.ts"]` — routes the native Rust module import to the pure-TypeScript fallback vendored at `native-ts/color-diff/`
3. `"moduleResolution": "bundler"` — lets `.js` extension imports resolve to `.ts` files (standard ESM convention used throughout the source)

- [ ] **Step 1: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "paths": {
      "src/*": ["./*"],
      "color-diff-napi": ["./native-ts/color-diff/index.ts"]
    }
  },
  "include": ["./**/*.ts", "./**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "feat: add tsconfig with src/ alias and color-diff-napi shim"
```

---

## Task 4: Create `package.json`

**Files:**
- Create: `package.json`

This is the complete dependency list derived from scanning all imports across the ~250 source files. Node built-ins (`fs`, `path`, `crypto`, etc.) are excluded — Bun provides them natively. The `ink` and `yoga-layout` packages are excluded — they are fully vendored in `ink/` and `native-ts/yoga-layout/` respectively.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "claude-code",
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "start": "bun run main.tsx"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "@anthropic-ai/mcpb": "latest",
    "@anthropic-ai/sandbox-runtime": "latest",
    "@anthropic-ai/sdk": "latest",
    "@aws-sdk/client-bedrock-runtime": "latest",
    "@commander-js/extra-typings": "latest",
    "@growthbook/growthbook": "latest",
    "@modelcontextprotocol/sdk": "latest",
    "@opentelemetry/api": "latest",
    "@opentelemetry/api-logs": "latest",
    "@opentelemetry/core": "latest",
    "@opentelemetry/resources": "latest",
    "@opentelemetry/sdk-logs": "latest",
    "@opentelemetry/sdk-metrics": "latest",
    "@opentelemetry/sdk-trace-base": "latest",
    "@opentelemetry/semantic-conventions": "latest",
    "ajv": "latest",
    "asciichart": "latest",
    "auto-bind": "latest",
    "axios": "latest",
    "bidi-js": "latest",
    "chalk": "latest",
    "chokidar": "latest",
    "cli-boxes": "latest",
    "code-excerpt": "latest",
    "diff": "latest",
    "emoji-regex": "latest",
    "env-paths": "latest",
    "execa": "latest",
    "figures": "latest",
    "fuse.js": "latest",
    "get-east-asian-width": "latest",
    "google-auth-library": "latest",
    "highlight.js": "latest",
    "https-proxy-agent": "latest",
    "ignore": "latest",
    "indent-string": "latest",
    "lodash-es": "latest",
    "lru-cache": "latest",
    "marked": "latest",
    "p-map": "latest",
    "picomatch": "latest",
    "proper-lockfile": "latest",
    "qrcode": "latest",
    "react": "latest",
    "react-reconciler": "latest",
    "semver": "latest",
    "shell-quote": "latest",
    "signal-exit": "latest",
    "stack-utils": "latest",
    "strip-ansi": "latest",
    "supports-hyperlinks": "latest",
    "tree-kill": "latest",
    "type-fest": "latest",
    "undici": "latest",
    "usehooks-ts": "latest",
    "vscode-jsonrpc": "latest",
    "vscode-languageserver-protocol": "latest",
    "vscode-languageserver-types": "latest",
    "wrap-ansi": "latest",
    "ws": "latest",
    "xss": "latest",
    "zod": "latest"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "feat: add package.json with full dependency manifest"
```

---

## Task 5: Install dependencies

**Files:** none created — this populates `node_modules/` and creates `bun.lockb`

- [ ] **Step 1: Run `bun install`**

```bash
bun install
```

Expected: all packages download, `bun.lockb` created. If any package fails:

- **"Package not found"**: the package name may have changed on npm. Run `bun add <package>` to find the correct name, then update `package.json`.
- **"Peer dependency conflict"**: add `"trustedDependencies": ["<pkg>"]` under the root of `package.json` and re-run.
- **Build errors for native packages**: these don't apply here since `color-diff-napi` is shimmed via tsconfig and no other native packages are in the list.

- [ ] **Step 2: Verify `node_modules` populated**

```bash
ls node_modules/@anthropic-ai/sdk
```
Expected: directory listing of the SDK package contents.

- [ ] **Step 3: Commit lockfile**

```bash
git add bun.lockb
git commit -m "chore: add bun lockfile after initial install"
```

---

## Task 6: First run and error triage

This task runs `main.tsx` for the first time and works through any remaining module resolution errors. Expect 1–5 iterations.

- [ ] **Step 1: Run with `--help` to test startup without API calls**

```bash
bun run main.tsx --help
```

Expected: Claude Code help text printed, process exits 0. This confirms the module graph loads correctly.

If you see **`Cannot find module 'X'`**: add `X` to the stubs list in `shims/preload.ts` following the same pattern as the `@ant/*` stubs, OR add it to `package.json` dependencies and re-run `bun install`. Use the error message to identify which file triggered the import to understand whether it's an internal or external package.

- [ ] **Step 2: Run the REPL**

```bash
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE bun run main.tsx
```

Expected: the interactive REPL launches, shows the Claude Code prompt, and is ready for input.

- [ ] **Step 3: Send a test prompt**

Type `Hello` and press Enter.

Expected: Claude responds with a greeting. This confirms the full API round-trip works: auth → API call → tool handling → response rendering.

- [ ] **Step 4: Test core tools**

In the REPL, run:
```
List the files in the current directory
```
Expected: Claude uses GlobTool or BashTool to list files and returns results.

```
Read the file README.md
```
Expected: Claude uses FileReadTool and returns the file content.

- [ ] **Step 5: Commit any fixes made during triage**

```bash
git add -p   # stage only the triage fixes
git commit -m "fix: resolve startup module errors found during first run"
```

---

## Success Criteria

1. `bun install` exits 0 with all packages installed
2. `bun run main.tsx --help` prints usage and exits 0
3. `ANTHROPIC_API_KEY=... bun run main.tsx` opens the interactive REPL
4. A `Hello` prompt returns a Claude response
5. GlobTool, BashTool, and FileReadTool execute correctly in the REPL
