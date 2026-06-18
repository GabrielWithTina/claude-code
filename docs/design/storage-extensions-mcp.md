# Extension And MCP Storage

## Purpose

Claude Code's extension storage covers two related systems:

- Plugins: installed plugin metadata, marketplace registry, versioned plugin
  code caches, and persistent plugin data directories.
- MCP: server configuration, project `.mcp.json`, plugin-provided MCP config,
  and the short-lived "needs auth" cache for remote MCP servers.

Live plugin objects and live MCP clients are runtime state. Disk storage only
records intent, installation metadata, config, and cacheable support files.

---

## Source Map

| Source | Role |
|---|---|
| `utils/plugins/pluginDirectories.ts` | Central plugin directory paths and persistent plugin data directories. |
| `utils/plugins/installedPluginsManager.ts` | `installed_plugins.json` migration, read, write, and synchronization. |
| `utils/plugins/marketplaceManager.ts` | `known_marketplaces.json` read/write and marketplace install locations. |
| `utils/plugins/schemas.ts` | Plugin and marketplace file schemas. |
| `utils/plugins/pluginLoader.ts` | Plugin cache loading from installed metadata and marketplace directories. |
| `services/mcp/config.ts` | `.mcp.json` read/write, merged MCP config sources, validation. |
| `services/mcp/client.ts` | MCP auth-needed cache and connection-level runtime caches. |
| `docs/design/mcp.md` | MCP runtime integration and connection lifecycle. |

---

## Plugin Directory Layout

Default plugin root:

```text
~/.claude/plugins/
  installed_plugins.json
  known_marketplaces.json
  blocklist.json
  config.json
  cache/
    <marketplace>/<plugin>/<version>/...
  marketplaces/
    <marketplace>/...
  data/
    <plugin-id-sanitized>/...
  repos/
```

The root can switch to `~/.claude/cowork_plugins` in cowork mode, or to an
explicit path via `CLAUDE_CODE_PLUGIN_CACHE_DIR`.

Plugin seed directories can be layered through `CLAUDE_CODE_PLUGIN_SEED_DIR`.
Seeds mirror the primary plugin directory and are read-only fallback layers.

## Observed Plugin Samples

Observed files:

```text
~/.claude/plugins/installed_plugins.json
~/.claude/plugins/known_marketplaces.json
~/.claude/plugins/blocklist.json
~/.claude/plugins/config.json
~/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/
~/.claude/plugins/marketplaces/superpowers-marketplace/
~/.claude/plugins/data/superpowers-superpowers-marketplace/
```

`installed_plugins.json` sample shape:

```json
{
  "version": 2,
  "plugins": {
    "superpowers@superpowers-marketplace": {
      "id": "superpowers@superpowers-marketplace",
      "marketplace": "superpowers-marketplace",
      "name": "superpowers",
      "version": "5.0.7",
      "installPath": "/home/user/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7",
      "scope": "user"
    }
  }
}
```

Field meaning:

| Field | Meaning |
|---|---|
| `version` | Metadata file format version. Current manager writes V2. |
| `plugins` | Map from plugin id to install metadata. |
| `id` | Full plugin identifier, usually `<name>@<marketplace>`. |
| `marketplace` | Marketplace that supplied the plugin. |
| `name` | Plugin name within the marketplace. |
| `version` | Installed plugin version. |
| `installPath` | Versioned cache path used by the loader. |
| `scope` | Scope where the plugin is installed or enabled. |

`known_marketplaces.json` sample shape:

```json
{
  "superpowers-marketplace": {
    "source": "github:owner/repo",
    "installLocation": "/home/user/.claude/plugins/marketplaces/superpowers-marketplace",
    "lastUpdated": "2026-06-15T00:00:00.000Z"
  }
}
```

Field meaning:

| Field | Meaning |
|---|---|
| `source` | Marketplace source, such as GitHub repository or local path. |
| `installLocation` | Local checkout/cache path for the marketplace. |
| `lastUpdated` | Timestamp of last marketplace update. |

`blocklist.json` sample shape:

```json
{
  "fetchedAt": "2026-06-15T00:00:00.000Z",
  "plugins": [
    {
      "plugin": "bad-plugin@example",
      "added_at": "2026-06-01T00:00:00.000Z",
      "reason": "security",
      "text": "Blocked for unsafe behavior"
    }
  ]
}
```

## Plugin Storage Rules

| Rule | Reason |
|---|---|
| Settings declare enablement intent. | `settings.json.enabledPlugins` is the user/project-facing source for enabled plugins. |
| `installed_plugins.json` records installation state. | It tracks cached versions and install paths that settings alone cannot know. |
| Versioned plugin cache is disposable. | `cache/<marketplace>/<plugin>/<version>` can be replaced by updates and garbage collection. |
| `plugins/data/<plugin-id>/` persists across updates. | Exposed as plugin data storage for plugin-owned state. |
| Marketplace registry is separate from installed plugins. | A marketplace can be known even when no plugin from it is enabled. |
| Plugin id path components are sanitized. | Persistent data dirs replace unsafe characters with `-`. |

## MCP Config Files

MCP config can come from several places:

| Source | Path or origin | Scope |
|---|---|---|
| Enterprise/managed settings | managed policy settings | `enterprise` or `managed` |
| User settings | `~/.claude/settings.json` | `user` |
| Project settings | `<project>/.claude/settings.json` | `project` |
| Project MCP file | `<project>/.mcp.json` | `project` |
| Local settings | `<project>/.claude/settings.local.json` | `local` |
| Plugin-provided config | plugin marketplace/cache files | `dynamic` |
| claude.ai connectors | remote connector API | `claudeai` |
| CLI flags | `--mcp-config`, `--mcp-server` | dynamic/highest precedence |

When `--strict-mcp-config` is enabled, only CLI dynamic MCP config is used.

Observed plugin marketplace `.mcp.json` sample shape:

```json
{
  "github": {
    "type": "http",
    "url": "https://example.invalid/mcp",
    "headers": {
      "Authorization": "Bearer ${GITHUB_TOKEN}"
    }
  }
}
```

Project `.mcp.json` synthetic sample:

```json
{
  "filesystem": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
    "env": {
      "LOG_LEVEL": "info"
    }
  },
  "docs": {
    "type": "sse",
    "url": "https://mcp.example.invalid/sse"
  }
}
```

Common server fields:

| Field | Meaning |
|---|---|
| `type` | Transport type: `stdio`, `sse`, `http`, `ws`, `sdk`, `claudeai-proxy`, or IDE variants. |
| `command` | Stdio command to launch. |
| `args` | Stdio command arguments. |
| `env` | Environment variables for stdio process. |
| `url` | Remote MCP endpoint for HTTP/SSE/WebSocket transports. |
| `headers` | HTTP headers for remote transports. Sensitive headers are redacted in logs. |

## MCP Auth-Needed Cache

Remote MCP servers that return OAuth/auth errors can be marked as
`needs-auth`. The short-lived cache prevents repeated startup prompts for the
same server.

Path:

```text
~/.claude/mcp-needs-auth-cache.json
```

Source-defined shape:

```json
{
  "github": {
    "timestamp": 1781488560000
  },
  "docs-server": {
    "timestamp": 1781488500000
  }
}
```

Rules:

| Rule | Behavior |
|---|---|
| TTL | 15 minutes. |
| Read cache | Missing or malformed file is treated as empty. |
| Write cache | Writes are serialized through a promise chain to avoid concurrent read-modify-write races. |
| Clear cache | Runtime can invalidate auth cache entries when auth state changes. |

## Runtime Boundary

Disk storage does not contain live MCP clients or connected tool objects.
Those live in `AppState.mcp` after connection:

```text
MCP config files
  -> getClaudeCodeMcpConfigs()
  -> connectToServer()
  -> ConnectedMCPServer and MCPTool objects in AppState
  -> tool pool for the next query turn
```

Plugin storage has a similar boundary:

```text
settings enabledPlugins + installed_plugins.json + marketplace cache
  -> plugin loader
  -> commands, skills, hooks, MCP servers, LSP configs
  -> runtime registries and AppState
```

## Design Notes

- Plugin enablement intent and plugin install state are intentionally split so
  settings can stay human-editable while install metadata tracks cache paths.
- Plugin data dirs are the only plugin-owned durable write surface designed to
  survive plugin updates.
- Project `.mcp.json` is easy to inspect and edit, but it is also a protected
  file in permission checks because MCP servers can execute code or exfiltrate
  data.
- MCP auth-needed cache is deliberately short-lived. It is product UX state,
  not an authentication token store.
