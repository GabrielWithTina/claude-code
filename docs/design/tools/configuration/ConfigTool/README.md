# ConfigTool Design

`ConfigTool` lets the model read and update supported Claude Code settings
without shelling out to config files directly. The tool is deferred and only
sets values that are present in the supported settings registry.

## Source Map

| File | Purpose |
|---|---|
| `tools/ConfigTool/ConfigTool.ts` | Tool schema, permission behavior, validation, and read/write execution. |
| `tools/ConfigTool/supportedSettings.ts` | Supported setting registry, value validation, source selection, and app-state sync hooks. |
| `tools/ConfigTool/prompt.ts` | Dynamic prompt generated from the supported setting list. |
| `tools/ConfigTool/UI.tsx` | User-facing renderers for reads, writes, and errors. |
| `tools/ConfigTool/constants.ts` | Tool name constant. |

## Behavior

The input is `{ setting, value? }`. Omitting `value` reads the current setting;
providing `value` writes it. Reads are read-only and auto-allowed. Writes are
not read-only and go through the permission system.

Settings are not free-form keys. `supportedSettings.ts` defines each supported
setting's type, config source, validation, formatting, and optional app-state
sync. Some settings are stored in global config, while others are stored in
settings files.

## Notable Details

- The prompt is generated from the registry so schema, docs, and runtime
  support stay aligned.
- `remoteControlAtStartup` accepts `"default"` by deleting the global config
  key rather than writing a literal default value.
- Voice settings run a write-time runtime preflight before being accepted.
- GrowthBook-gated settings are hidden from prompt text when disabled.

