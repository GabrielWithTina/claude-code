// shims/preload.ts
// Runs before main.tsx via bunfig.toml preload.
// Shims compile-time Bun modules and internal @ant/* packages that are not on npm.

// MACRO is inlined at bundle/compile time by the Bun bundler.
// At runtime (bun run), we define it as a global with sensible defaults.
declare global {
  var MACRO: {
    VERSION: string
    BUILD_TIME: string
    ISSUES_EXPLAINER: string
  }
}
globalThis.MACRO = {
  VERSION: '0.0.1',
  BUILD_TIME: '',
  ISSUES_EXPLAINER: 'visit https://github.com/anthropics/claude-code/issues',
}

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
