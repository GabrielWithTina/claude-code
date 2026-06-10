# SleepTool Design

`SleepTool` is represented in this recovered checkout by prompt metadata only.
The executable tool implementation is not present in `tools/SleepTool`.

## Source Map

| File | Purpose |
|---|---|
| `tools/SleepTool/prompt.ts` | Tool name, description, and model-facing sleep guidance. |

## Prompt Contract

The prompt describes a non-shell sleep primitive for waiting without holding a
shell process. It says the user can interrupt the sleep, that tick prompts may
arrive during periodic check-ins, and that the tool can run concurrently with
other tools.

## Recovered Source Boundary

No `SleepTool.ts`, schema, permission handler, call implementation, or UI
renderer exists in this recovered folder. This document therefore records only
the prompt-level design visible in the current tree.

