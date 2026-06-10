# ScheduleCronTool Design

`ScheduleCronTool` is a subsystem folder containing three deferred tools:
`CronCreate`, `CronDelete`, and `CronList`.

## Source Map

| File | Purpose |
|---|---|
| `tools/ScheduleCronTool/CronCreateTool.ts` | Schedule creation schema, validation, persistence selection, and scheduler activation. |
| `tools/ScheduleCronTool/CronDeleteTool.ts` | Job deletion schema, ownership validation, and cancellation. |
| `tools/ScheduleCronTool/CronListTool.ts` | Job listing schema, teammate filtering, and result formatting. |
| `tools/ScheduleCronTool/prompt.ts` | Feature gates, durability gates, cron prompt text, and tool names. |
| `tools/ScheduleCronTool/UI.tsx` | Create/delete/list rendering helpers. |

## CronCreate

`CronCreate` accepts a standard five-field local-time cron expression, prompt,
optional `recurring`, and optional `durable`. It validates cron syntax, rejects
schedules with no run in the next year, enforces a maximum of 50 jobs, and
rejects durable teammate crons. Session-only jobs live in memory; durable jobs
persist to `.claude/scheduled_tasks.json` when durability is enabled.

## CronDelete

`CronDelete` cancels a job by ID. It validates that the job exists. Teammates may
delete only jobs owned by their own agent ID.

## CronList

`CronList` returns scheduled jobs with IDs, cron strings, human schedules,
prompts, recurrence flags, and durability flags. Teammates see only their own
jobs; the team lead sees all jobs.

## Enablement

All three tools are gated by the `AGENT_TRIGGERS` build feature, the runtime
cron kill switch, and `CLAUDE_CODE_DISABLE_CRON`. Durable persistence has a
separate runtime kill switch.

