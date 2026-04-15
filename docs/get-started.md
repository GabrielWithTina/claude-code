# How to run it

```shell
# Non-interactive mode
bun run entrypoints/cli.tsx --debug -p "outline the summary of the current project"

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

1. Open the project in VSCode:

   ```
   code /home/xiaos/git/claude-code
   ```

2. Set breakpoints by clicking the left gutter of any `.ts` / `.tsx` file

3. Press `F5` (or go to **Run → Start Debugging**) and select:

   ```
   Bun: Debug CLI
   ```

4. The debugger will launch `entrypoints/cli.tsx` via Bun with debug protocol enabled

5. Execution pauses at your breakpoints:

   - Inspect variables
   - Step through code
   - Use the debug console

------

## Alternative: Attach to a Running Process

If you want to run the app manually and attach the debugger:

```
bun --inspect entrypoints/cli.tsx
```

Then use the **"Bun: Attach to Running Process"** configuration in VSCode.

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