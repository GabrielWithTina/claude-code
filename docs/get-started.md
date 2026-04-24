# How to run it

```shell
# Non-interactive mode
bun run entrypoints/cli.tsx --debug -p "outline the summary of the current project"

# interactive mode
bun run entrypoints/cli.tsx

```

# Debug - A Quick Primer
## TypeScript + Bun Mental Model

Since you're new to TypeScript development, here's the mental model:

| Concept                   | What it means here                                           |
| ------------------------- | ------------------------------------------------------------ |
| **TypeScript (.ts/.tsx)** | JavaScript with type annotations. Bun runs it directly — no compile step needed. |
| **Bun**                   | A fast JS/TS runtime (like Node.js but faster). It can run `.ts` files natively. |
| **entrypoints/cli.tsx**   | The app's entry point. It imports `main.tsx` which does the real work. |
| **bunfig.toml**           | Tells Bun to run `shims/preload.ts` before anything else (sets up globals, disables telemetry). |
| **tsconfig.json**         | Tells VSCode/TypeScript how to resolve imports and check types. Not needed to run the code. |

------

## Install bun extension in VSCode
search for "Bun" by Oven, and click Install. Make sure to install it in the WSL side

## How to Debug

If you want to run the app manually and attach the debugger:

```
bun --inspect-wait=127.0.0.1:6499/mytoken entrypoints/cli.tsx
```

Then use the **"Bun: Attach to Running Process"** configuration in VSCode.

To further profile the instance with extensive debugging info:
```
export CLAUDE_CODE_PROFILE_QUERY=1 
bun --inspect-wait=127.0.0.1:6499/mytoken entrypoints/cli.tsx --debug
```

Then see the debug info in `~/.claude/debug/latest`

------

## Important Caveats for This Project

- **`bun:bundle` imports will fail at debug time**

  - The preload shim (`shims/preload.ts`) patches some of these
  - `feature()` calls from `bun:bundle` only work in Bun's bundler, not at runtime
  - The preload shim already handles this

- **No API key = no real conversation**

  - You'll need an `ANTHROPIC_API_KEY` environment variable to talk to Claude
  - For exploring code flow, breakpoints in startup work fine without one

- **Telemetry is disabled**

  - The preload shim sets:

    ```
    DISABLE_TELEMETRY=1
    ```

  - So GrowthBook won't block startup