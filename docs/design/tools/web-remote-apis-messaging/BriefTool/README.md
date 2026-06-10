# BriefTool - User Message Attachments

## Module Map

| File | Role |
|---|---|
| `tools/BriefTool/BriefTool.ts` | `SendUserMessage` tool definition, enablement gates, schema, validation, and call flow |
| `tools/BriefTool/attachments.ts` | Attachment path validation, stat collection, image detection, and optional bridge upload dispatch |
| `tools/BriefTool/upload.ts` | Bridge-mode multipart upload to private API for web preview |
| `tools/BriefTool/prompt.ts` | Tool name, legacy alias, and model-facing prompt |
| `tools/BriefTool/UI.tsx` | Message and attachment rendering |

## Purpose

`BriefTool` is registered as `SendUserMessage` with the legacy alias `Brief`.
Most of the tool is a communication surface, but it has a file-facing attachment
subsystem: the model can attach local files to a user-visible message by passing
absolute or cwd-relative paths.

This documentation covers the attachment behavior because it is a user-facing
file path surface not covered by the FileRead/FileWrite/FileEdit docs.

## Enablement

The tool is bundled behind `KAIROS` or `KAIROS_BRIEF`. Runtime enablement is a
combination of:

- assistant mode state,
- explicit user opt-in such as `--brief`, `/brief`, default chat view, or SDK
  tool selection,
- the `tengu_kairos_brief` GrowthBook gate,
- the `CLAUDE_CODE_BRIEF` development override.

`isBriefEnabled()` is intentionally lazy and is used by `Tool.isEnabled()` so
startup state can be initialized before the tool is exposed.

## Tool Shape

Input:

| Field | Meaning |
|---|---|
| `message` | Markdown-capable text to send to the user |
| `attachments` | Optional file paths, absolute or relative to cwd |
| `status` | `normal` for direct replies, `proactive` for unsolicited status |

Output:

| Field | Meaning |
|---|---|
| `message` | Sent text |
| `attachments` | Resolved metadata: full path, size, image flag, and optional uploaded `file_uuid` |
| `sentAt` | Execution timestamp |

Attachments remain optional in output for replay compatibility with older
sessions that predate attachment support.

## Attachment Validation

`validateInput()` delegates to `validateAttachmentPaths()` when attachments are
present. Validation is intentionally local and simple:

1. Resolve every raw path with `expandPath()`.
2. `stat()` the resolved path.
3. Require a regular file.
4. Return clear validation errors for missing files and permission-denied
   access.

The current cwd is included in missing-file errors to help the model correct
relative paths.

## Attachment Resolution And Upload

`resolveAttachments()` stats paths serially to keep attachment ordering
deterministic. It records the resolved full path, byte size, and whether the
path extension looks like a supported image.

When `BRIDGE_MODE` is compiled in, resolution can also upload attachments to
the private OAuth upload endpoint. Uploading is best-effort:

- non-bridge local renderers can still use the file path,
- files larger than 30 MB are skipped,
- missing bridge auth or upload failures return `undefined`,
- image MIME detection is limited to PNG, JPEG, GIF, and WebP; all other files
  upload as `application/octet-stream`.

Successful uploads add `file_uuid` so web viewers can preview content that
would otherwise exist only on the CLI host filesystem.

## Result Mapping

The model-facing tool result is short: `Message delivered to user.` with an
attachment count suffix when files were included. Attachment metadata remains in
the structured output for renderers and SDK consumers.

## Sources

- `tools/BriefTool/BriefTool.ts`
- `tools/BriefTool/attachments.ts`
- `tools/BriefTool/upload.ts`
- `tools/BriefTool/prompt.ts`
