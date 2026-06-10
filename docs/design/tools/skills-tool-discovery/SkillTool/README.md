# SkillTool Design

`SkillTool` executes slash-command skills inside a forked agent context. It is
the bridge from discovered command metadata to an isolated agent run with the
skill prompt loaded.

## Source Map

| File | Purpose |
|---|---|
| `tools/SkillTool/SkillTool.ts` | Tool schema, command resolution, permission checks, forked-agent execution, result extraction, and telemetry. |
| `tools/SkillTool/prompt.ts` | Skill invocation prompt and skill-list budgeting helpers. |
| `tools/SkillTool/UI.tsx` | Skill progress, result, rejection, and error rendering. |
| `tools/SkillTool/constants.ts` | Tool name constant. |

## Command Resolution

The tool loads local and bundled prompt commands and also includes MCP-loaded
skills from app state. It filters MCP commands to prompt skills, avoiding plain
MCP prompts that are not meant to be invoked through this tool.

## Execution Model

When invoked, the skill content and arguments are prepared into a forked command
context. The tool creates a new agent ID, runs `runAgent()` with the skill's
agent definition and optional model/effort overrides, streams progress for
nested tool uses, and extracts result text back into the parent tool result.

## Prompt Budgeting

`prompt.ts` formats the available skill list within a small context budget.
Bundled skills keep full descriptions; non-bundled descriptions may be trimmed
or reduced to names when the list is too large.

