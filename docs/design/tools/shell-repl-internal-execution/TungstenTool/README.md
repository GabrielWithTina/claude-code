# TungstenTool Design

`TungstenTool` is present as a recovered internal-tool stub. It preserves the
tool name and module shape, but this checkout does not include a working
Tungsten integration.

## Source Map

| File | Purpose |
|---|---|
| `tools/TungstenTool/TungstenTool.ts` | Stub tool definition and exported reset/cleanup helpers. |
| `tools/TungstenTool/TungstenLiveMonitor.ts` | Live monitor module for the internal integration boundary. |

## Behavior

The tool name is `Tungsten`. Calling it throws `TungstenTool is not available in
this build.` The cleanup and initialization helpers are also stubs.

## Design Boundary

The recovered source keeps this folder so references can resolve, but no prompt,
schema, permission flow, UI renderer, or external execution path is implemented
in this build.

