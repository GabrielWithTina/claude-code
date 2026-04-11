// shims/preload.ts
// Runs before main.tsx via bunfig.toml preload.
// Shims compile-time Bun modules and internal @ant/* packages that are not on npm.

// Disable telemetry/analytics so GrowthBook skips its blocking HTTP init call.
// Without this, getDynamicConfig_BLOCKS_ON_INIT → initializeGrowthBook() →
// thisClient.init({ timeout: 5000 }) makes a network request that hangs startup
// when no GrowthBook endpoint is reachable.
// DISABLE_TELEMETRY=1 triggers the 'no-telemetry' privacy level, which causes
// isGrowthBookEnabled() to return false and all feature flags to return defaults.
process.env.DISABLE_TELEMETRY = '1'

// MACRO is inlined at bundle/compile time by the Bun bundler.
// At runtime (bun run), we define it as a global with sensible defaults.
declare global {
  var MACRO: {
    VERSION: string
    BUILD_TIME: string
    ISSUES_EXPLAINER: string
    FEEDBACK_CHANNEL: string
    PACKAGE_URL: string
    NATIVE_PACKAGE_URL: string
    VERSION_CHANGELOG: string
  }
}
;(globalThis as any).MACRO = {
  VERSION: '99.0.0', // High version to pass the GrowthBook-driven minimum version check
  BUILD_TIME: new Date().toISOString(),
  ISSUES_EXPLAINER: 'visit https://github.com/anthropics/claude-code/issues',
  FEEDBACK_CHANNEL: '',
  PACKAGE_URL: '@anthropic-ai/claude-code',
  NATIVE_PACKAGE_URL: '@anthropic-ai/claude-code',
  VERSION_CHANGELOG: '',
}

// Patch Commander.js to tolerate non-standard short flags like '-d2e'.
// The original source uses '-d2e, --debug-to-stderr' which Commander >= 12
// rejects at runtime (short flags must be exactly one letter after '-').
//
// Strategy: directly rewrite commander/lib/option.js on disk before it is
// ever require()d. We use a sentinel comment to make the patch idempotent so
// repeated runs (e.g. bun watch) don't corrupt the file. The file is written
// back synchronously so that the module loader sees the patched version.
//
// Note: we cannot use Bun.plugin onLoad for this because Bun's plugin system
// marks any module intercepted by onLoad as an ESM namespace object, which
// breaks commander's CJS require() chain (exports.Option becomes undefined).
;(() => {
  const fs = require('fs') as typeof import('fs')
  const path = require('path') as typeof import('path')
  const optionPath = path.resolve(
    __dirname,
    '../node_modules/commander/lib/option.js',
  )
  try {
    const src = fs.readFileSync(optionPath, 'utf8')
    if (!src.includes('__CLAUDE_CODE_SHIM__')) {
      const patched = src.replace(
        'function splitOptionFlags(flags) {',
        `function splitOptionFlags(flags) {
  // __CLAUDE_CODE_SHIM__: Strip non-standard short flags (multi-char after '-')
  // before Commander validates them. Required because the source uses the token
  // '-d2e, --debug-to-stderr' which Commander >= 12 otherwise rejects.
  flags = flags.split(/[ |,]+/).filter(function(f) {
    if (f.startsWith('--')) return true;        // long flag -- keep
    if (/^-[a-zA-Z]$/.test(f)) return true;    // valid short flag -- keep
    if (f.startsWith('-')) return false;         // invalid short flag (e.g. -d2e) -- strip
    return true;                                 // value placeholder (<x>, [x]) -- keep
  }).join(', ');`,
      )
      if (patched !== src) {
        fs.writeFileSync(optionPath, patched, 'utf8')
      }
    }
  } catch (_) {
    // If patching fails (e.g. read-only fs), continue — the CLI will throw at
    // Option construction time with a clear error from Commander.
  }
})()

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
    ]
    for (const pkg of antStubs) {
      build.module(pkg, () => ({ exports: {}, loader: 'object' }))
    }

    // @ant/claude-for-chrome-mcp exports BROWSER_TOOLS and other symbols used at module load time.
    build.module('@ant/claude-for-chrome-mcp', () => ({
      exports: {
        BROWSER_TOOLS: [],
        createClaudeForChromeMcpServer: () => { throw new Error('Claude for Chrome is not available in this build') },
      },
      loader: 'object',
    }))

    // .md files are bundled as text in the original build (Bun text loader).
    // The source tree is missing those .md assets, so we return empty strings
    // so the skills/bundled/**Content.ts imports resolve without error.
    build.onLoad({ filter: /\.md$/ }, () => ({
      contents: 'export default ""',
      loader: 'js',
    }))
  },
})
