# SyntheticOutputTool Design

`SyntheticOutputTool` exposes `StructuredOutput`, a synthetic read-only tool
used by non-interactive sessions to return final structured data.

## Source Map

| File | Purpose |
|---|---|
| `tools/SyntheticOutputTool/SyntheticOutputTool.ts` | Base tool, non-interactive enablement helper, JSON-schema-specific tool factory, AJV validation, and cache. |

## Base Tool

The base tool accepts any object input and returns a successful structured
output marker. It is read-only, concurrency-safe, non-MCP, and always allowed.
Its prompt requires the model to call the tool exactly once at the end of the
response.

## Schema-Specific Tools

`createSyntheticOutputTool(jsonSchema)` validates and compiles the provided JSON
schema with AJV, then returns a copy of the base tool whose `inputJSONSchema`
and `call()` enforce that schema. Invalid schemas return `{ error }`. Schema
objects are cached in a `WeakMap` by object identity to avoid repeated AJV
compilation in workflow-heavy paths.

## Enablement

`isSyntheticOutputToolEnabled()` returns true only for non-interactive sessions.
The main tool registry is expected to create this tool only under that gate.

