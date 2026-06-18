# Config And Settings Storage

## Purpose

Claude Code separates global config from settings. Global config is an
application-owned state file with defaults filtered out. Settings files are
user/project/policy-controlled configuration documents that are validated and
merged by source.

This split lets the product keep operational state such as project trust,
feature caches, onboarding flags, and account metadata out of human-authored
settings files, while still allowing users, projects, and enterprise policy to
control behavior through explicit settings.

---

## Source Map

| Source | Role |
|---|---|
| `utils/config.ts` | Global config and project config types, read/write path, defaults, backups, corruption handling. |
| `utils/settings/settings.ts` | Settings source resolution, validation, merge/update behavior, managed settings load. |
| `utils/settings/constants.ts` | Setting source names and editable source definitions. |
| `utils/settings/types.ts` | `SettingsJson` schema. |
| `utils/secureStorage/` | Platform secure-storage facade for secrets. |
| `utils/auth.ts` | API key/OAuth lookup and fallback behavior. |
| `services/remoteManagedSettings/` | Remote managed-policy cache path used by policy settings source. |

---

## Files And Scopes

| Store | Path | Owner | Observed sample |
|---|---|---|---|
| Global config | `~/.claude.json` | Claude Code runtime | Present, 60 top-level keys in sample. |
| User settings | `~/.claude/settings.json` or `~/.claude/cowork_settings.json` | User | Present, 11 top-level keys in sample. |
| Project settings | `<project>/.claude/settings.json` | Repository/project | Not present in the targeted project sample, source-defined. |
| Local settings | `<project>/.claude/settings.local.json` | Local machine | Present in plugin marketplace sample. |
| Managed settings | platform managed path `managed-settings.json` and `managed-settings.d/*.json` | Enterprise/admin policy | Source-defined. |
| Flag settings | bootstrap flag settings path | Runtime/CLI | Source-defined. |
| Remote managed settings | remote managed settings cache | Enterprise/API | Source-defined. |
| Config backups | `~/.claude/backups/<file>.backup.<timestamp>` | Config writer | Source-defined. |
| Corrupted config backups | `~/.claude/backups/<file>.corrupted.<timestamp>` | Config reader | Source-defined. |

## Global Config

`GlobalConfig` lives in `~/.claude.json`. The sample file had fields such as:

```json
{
  "numStartups": 720,
  "installMethod": "global",
  "autoUpdates": false,
  "hasSeenTasksHint": true,
  "cachedDynamicConfigs": {},
  "cachedGrowthBookFeatures": {},
  "projects": {},
  "tipsHistory": {},
  "theme": "dark"
}
```

Representative fields:

| Field | Meaning |
|---|---|
| `projects` | Map from normalized project path to `ProjectConfig`. Stores project trust, project-level metrics, MCP legacy fields, and active worktree session state. |
| `numStartups` | Startup counter. |
| `installMethod` | Install origin such as local, native, global, or unknown. |
| `theme`, `verbose`, `preferredNotifChannel` | UI and notification preferences. |
| `primaryApiKey` | Fallback API key field when platform keychain is not used. |
| `oauthAccount` | Cached account/profile metadata. |
| `cachedDynamicConfigs`, `cachedGrowthBookFeatures`, `cachedStatsigGates` | Feature/config caches used to avoid blocking startup. |
| `tipsHistory` | Tip display state. |
| `autoCompactEnabled`, `showTurnDuration`, `diffTool` | Product behavior preferences that predate or coexist with settings. |
| `mcpServers` | Legacy/global MCP server definitions. |
| `claudeAiMcpEverConnected` | Connector names that have successfully connected at least once. |

`saveConfig()` writes only values that differ from defaults. This keeps
`~/.claude.json` smaller and avoids persisting default noise. Writes use secure
permissions (`0600`) for newly created files.

### Project Config

Project config is nested under `GlobalConfig.projects[absolutePath]`.

```json
{
  "projects": {
    "/home/user/repo": {
      "allowedTools": [],
      "mcpContextUris": [],
      "hasTrustDialogAccepted": true,
      "projectOnboardingSeenCount": 1,
      "lastSessionId": "00000000-0000-0000-0000-000000000000"
    }
  }
}
```

Important fields:

| Field | Meaning |
|---|---|
| `allowedTools` | Legacy/project allowlist for tool permissions. |
| `mcpContextUris` | MCP resources selected as context. |
| `mcpServers` | Legacy project MCP definitions. |
| `hasTrustDialogAccepted` | Whether the project trust prompt has been accepted. |
| `projectOnboardingSeenCount` | Project onboarding counter. |
| `lastSessionId` and `last*` metrics | Last-session metrics used for UI/status. |
| `activeWorktreeSession` | Current worktree session metadata when worktree mode is active. |

## Config Read And Write Rules

| Rule | Behavior |
|---|---|
| Defaults are merged on read | Missing fields resolve to `createDefaultGlobalConfig()` or default project config. |
| Defaults are filtered on write | Stored JSON contains only values different from defaults. |
| Writes are guarded against auth loss | If a re-read looks like defaults and would drop cached auth state, write is refused. |
| Config writes can create backups | `saveConfigWithLock()` copies the current file into `~/.claude/backups/`, keeping the five most recent backups per file. |
| Corrupted config is not overwritten silently | Parse errors are reported, and corrupted content can be copied into a `.corrupted.<timestamp>` backup. |
| Global config is cached by mtime | `getGlobalConfig()` avoids repeated disk reads and tracks cache hit/miss diagnostics. |

## Settings Sources

Settings are merged from named sources. Editable sources write back to JSON
files; policy and flag sources are read-only from the settings writer.

| Source | Path or origin | Editable | Purpose |
|---|---|---:|---|
| `policySettings` | remote managed settings, MDM/plist/HKLM, `managed-settings.json`, `managed-settings.d/*.json`, HKCU | No | Enterprise policy. |
| `userSettings` | `~/.claude/settings.json` or `~/.claude/cowork_settings.json` | Yes | User preferences and global plugin enablement intent. |
| `projectSettings` | `<project>/.claude/settings.json` | Yes | Repository-scoped shared settings. |
| `localSettings` | `<project>/.claude/settings.local.json` | Yes | Machine-local overrides. Added to `.gitignore` when written. |
| `flagSettings` | bootstrap flag settings | No | CLI/flag-provided settings. |

Policy origin precedence is:

```text
remote managed settings
  > MDM / plist / HKLM
  > managed-settings.json + managed-settings.d/*.json
  > HKCU
```

## User Settings Sample

Observed `~/.claude/settings.json` shape:

```json
{
  "permissions": {},
  "model": "opus",
  "enabledPlugins": {
    "superpowers@superpowers-marketplace": {
      "scope": "user"
    }
  },
  "extraKnownMarketplaces": {
    "superpowers-marketplace": {
      "source": "github:user/repo"
    }
  },
  "alwaysThinkingEnabled": true,
  "autoMemoryEnabled": true,
  "autoDreamEnabled": true,
  "theme": "dark",
  "autoCompactEnabled": false,
  "hooks": {
    "PostToolUse": [],
    "PreToolUse": []
  }
}
```

Field meaning:

| Field | Meaning |
|---|---|
| `permissions` | Permission rules and mode-related settings. |
| `model` | Preferred model alias/name. |
| `enabledPlugins` | Desired enabled plugin ids and scope metadata. Installation state lives separately in plugin storage. |
| `extraKnownMarketplaces` | User-declared extra plugin marketplaces. |
| `alwaysThinkingEnabled` | Thinking-mode preference. |
| `autoMemoryEnabled`, `autoDreamEnabled` | Memory and AutoDream gates. |
| `skipDangerousModePermissionPrompt` | Whether to skip the dangerous-mode confirmation prompt. |
| `theme` | UI theme. |
| `autoCompactEnabled` | Auto-compaction setting. |
| `hooks` | Hook command configuration grouped by hook event. |

## Settings Update Rules

`updateSettingsForSource()` reads the current settings file, merges the provided
partial settings object, writes pretty JSON with a trailing newline, and resets
the settings cache.

Merge semantics:

| Input shape | Behavior |
|---|---|
| Object field | Deep-merged by lodash `mergeWith`. |
| Array field | Replaced wholesale by the provided array. |
| Record key set to `undefined` | Deletes that key. |
| Invalid JSON syntax | Returns an error instead of overwriting the file. |
| Invalid schema but parseable object | Uses raw object as merge base so a targeted edit can repair the file. |

## Auth And Secret Storage

Auth material is split between multiple places:

| Store | Meaning |
|---|---|
| macOS Keychain | Preferred storage for managed API key on macOS. |
| `~/.claude.json.primaryApiKey` | Fallback storage when keychain is unavailable or not used. |
| OAuth token sources | OAuth tokens can arrive from environment/file descriptors or OAuth services. |
| Settings `env` / API-key helpers | User-controlled config for API-key environments and helpers. |

`getSecureStorage()` chooses macOS Keychain with plaintext fallback on macOS,
and plaintext storage on other platforms. Linux libsecret support is not present
in this recovered source.

Important boundary: managed OAuth contexts such as remote sessions and Claude
Desktop avoid falling back to the user's terminal CLI API-key settings. Those
settings belong to terminal usage and can be wrong for managed sessions.

## Synthetic Samples

Managed settings file:

```json
{
  "permissions": {
    "deny": ["Bash(rm -rf:*)"]
  },
  "env": {
    "NODE_EXTRA_CA_CERTS": "/etc/company/ca.pem"
  },
  "autoMemoryEnabled": false
}
```

Project local settings:

```json
{
  "enabledPlugins": {
    "repo-helper@example-marketplace": {
      "scope": "project"
    }
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/check-bash.py"
          }
        ]
      }
    ]
  }
}
```

Global config project entry:

```json
{
  "projects": {
    "/home/user/repo": {
      "hasTrustDialogAccepted": true,
      "projectOnboardingSeenCount": 1,
      "lastSessionId": "11111111-1111-4111-8111-111111111111",
      "activeWorktreeSession": {
        "originalCwd": "/home/user/repo",
        "worktreePath": "/home/user/repo-worktrees/feature",
        "worktreeName": "feature",
        "sessionId": "22222222-2222-4222-8222-222222222222"
      }
    }
  }
}
```

## Design Notes

- Settings are the user-facing configuration surface; global config is internal
  product state plus legacy configuration.
- Policy settings are read-only in the normal settings writer because they can
  originate from remote or administrator-controlled sources.
- Local settings are intentionally machine-local. They are written under the
  project but should not be committed.
- The config writer treats auth loss as a data-loss bug. It refuses writes when
  a transient parse/read failure would overwrite known auth state with defaults.
