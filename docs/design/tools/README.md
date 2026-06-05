# Tool Design Documents

This directory contains subsystem design notes for tool implementations.

| Tool | Docs | Covers |
|---|---|---|
| AgentTool | [agenttool/README.md](./agenttool/README.md) | Subagent delegation, runner lifecycle, agent definitions, fork/resume, memory, and UI |
| Task tools | [tasktools/README.md](./tasktools/README.md) | TodoV2 task-list tools, file-backed task storage, background task output, and task stopping |
| AskUserQuestionTool | [askuserquestiontool/README.md](./askuserquestiontool/README.md) | Interactive multiple-choice prompting: schemas, lifecycle flags, preview feature, validation, result mapping, and UI |
| BashTool | [BashTool/README.md](./BashTool/README.md) | Shell command execution: tool definition & call() engine, security/injection defense, permission engine, read-only & sandbox classification, path boundaries, sed handling, and UI |
| FileEditTool | [FileEditTool/README.md](./FileEditTool/README.md) | In-place string-replacement edits: tool definition, 13-gate validation & 10-phase call() engine, the matching/replacement/patch engine, and diff/rejection UI |
| FileWriteTool | [FileWriteTool/README.md](./FileWriteTool/README.md) | Whole-file create & overwrite: tool definition, validation & call() engine, create-vs-update handling, code shared with FileEditTool, and new-file/diff UI |
| FileReadTool | [FileReadTool/README.md](./FileReadTool/README.md) | Reading text/images/PDFs/notebooks: tool definition, file-type-branching call() engine, readFileState registration (the read-before-write gate), limits, and image-resize pipeline |
| GrepTool | [GrepTool/README.md](./GrepTool/README.md) | Content search via ripgrep: schema, the arg-building/result-parsing pipeline, the three output modes (content/files/count), and result UI |
| GlobTool | [GlobTool/README.md](./GlobTool/README.md) | File-name pattern matching via ripgrep --files: schema, lifecycle, call() engine, mtime sorting/truncation, and Glob-vs-Grep guidance |

Add new tool documentation in its own subdirectory under `docs/design/tools/`.
