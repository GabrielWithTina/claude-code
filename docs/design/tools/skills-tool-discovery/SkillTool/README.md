# SkillTool Design

`SkillTool` is one of two skill execution paths. It executes slash-command
skills inside a forked agent context when a skill needs to be invoked as a tool.
Skills can also be loaded inline into the current conversation, in which case
the assistant follows the loaded skill instructions directly and does not invoke
`SkillTool` again.

## Source Map

| File | Purpose |
|---|---|
| `tools/SkillTool/SkillTool.ts` | Tool schema, command resolution, permission checks, forked-agent execution, result extraction, and telemetry. |
| `tools/SkillTool/prompt.ts` | Skill invocation prompt, inline-loaded skill guard, and skill-list budgeting helpers. |
| `tools/SkillTool/UI.tsx` | Skill progress, result, rejection, and error rendering. |
| `tools/SkillTool/constants.ts` | Tool name constant. |

## Command Resolution

The tool loads local and bundled prompt commands and also includes MCP-loaded
skills from app state. It filters MCP commands to prompt skills, avoiding plain
MCP prompts that are not meant to be invoked through this tool.

## Execution Paths

### Inline Loaded Skill

A skill can already be loaded into the current conversation turn. The prompt
contract identifies this with a command-name tag in the conversation context. In
that case, the model should follow the skill instructions directly in the main
thread and must not call `SkillTool` again for the same skill.

Inline loading keeps the work in the parent conversation. There is no new agent
ID, no forked message history, and no `SkillTool` result extraction step.

Inline skill loading is assembled by the slash-command processing path rather
than by `SkillTool.ts`. For a prompt command, the processor renders the command
with `command.getPromptForCommand(args, context)`, registers any skill hooks,
records the invoked skill with `addInvokedSkill(...)` so compaction can preserve
it, and appends messages to the parent conversation:

| Parent message/input part | Source |
|---|---|
| Command metadata message | `formatCommandLoadingMetadata(...)`, including `command-message`, `command-name`, and optional command args tags. |
| Skill content message | The rendered skill prompt, marked as meta content in the main thread. |
| Attachment messages | Attachments extracted from the rendered skill content, with skill discovery skipped so the skill body does not recursively trigger discovery. |
| Command permissions attachment | Parsed `command.allowedTools`, plus optional command model metadata. |

The current parent query then runs with those inline messages. The skill's
instructions are part of the parent conversation context, and any additional
allowed tools are carried as command-permission context for that turn. This is
why the `SkillTool` prompt tells the model not to invoke `SkillTool` when it sees
the command-name tag: the skill has already been loaded into the main thread.

Coordinator mode is a special case. On the main thread, it may avoid loading the
full skill body and instead provide a summary telling the coordinator how to
delegate the skill to a worker. Worker agents can still invoke the skill and
receive the full content and permissions.

### Forked SkillTool Execution

When invoked, the skill content and arguments are prepared into a forked command
context. The tool creates a new agent ID, runs `runAgent()` with the skill's
agent definition and optional model/effort overrides, streams progress for
nested tool uses, and extracts result text back into the parent tool result.

This path is used when the assistant needs to invoke a discovered slash-command
skill as a tool. The tool isolates the skill run from the parent context while
still reporting progress and returning the final extracted result.

## Forked Context Assembly

Forked skill execution uses the same `runAgent()` machinery as subagents, but the
initial context is assembled from skill metadata and rendered skill content:

| Context part | Source |
|---|---|
| Agent definition | `command.agent` from skill metadata, otherwise `general-purpose`, otherwise the first active agent. |
| System prompt | The selected agent definition's `getSystemPrompt(...)`, enhanced by `runAgent()` with environment and enabled-tool details. |
| Initial messages | A single user message containing the rendered skill prompt. `command.getPromptForCommand(args, context)` injects the parent-provided arguments into the skill content. |
| Tool inventory | The parent tool pool passed as `availableTools`, filtered by the selected agent definition's `tools` and `disallowedTools`, plus any agent-specific MCP tools. |
| Permission allowance | Skill `allowedTools` is parsed and added to the forked app state's permission context as session allow rules. |
| Model and effort | Optional skill metadata can override the model and effort used by the selected agent definition. |

The rendered skill content is not the system prompt. It is sent as the first user
message to the forked agent. The system prompt comes from the selected agent
type, so a skill that specifies `agent: general-purpose` still runs with the
general-purpose agent system behavior while receiving the skill instructions as
its task prompt.

The SkillTool fork path does not pass the parent conversation as
`forkContextMessages`. The forked agent starts from the rendered skill prompt
instead of automatically copying the parent message history. The parent can
still influence the run through skill arguments, current app state, active tool
definitions, permissions, and command context passed to prompt rendering.

Skill `allowedTools` should not be read as the full tool inventory. It grants
permission allowance for named tools, while `runAgent()` still resolves the
actual callable tools from the selected agent definition and the current
available tool pool.

## Prompt Budgeting

`prompt.ts` formats the available skill list within a small context budget.
Bundled skills keep full descriptions; non-bundled descriptions may be trimmed
or reduced to names when the list is too large.
