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
