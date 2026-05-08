# Compact Subsystem Design

## Overview

The compact subsystem (`services/compact/`) manages conversation context size through multiple complementary strategies. They form a layered defense against context window overflow, each operating at a different granularity, trigger condition, and cost.

## Compaction Strategies

### 1. Microcompact (`microCompact.ts`) — Pre-Request, Lightweight

Entry point: `microcompactMessages()`, called in the query loop **before** each API call.

Three sub-strategies, evaluated in order with short-circuit:

#### 1a. Time-Based Microcompact (Cold Cache Path)

- **Trigger:** Gap since last assistant message exceeds `gapThresholdMinutes` (default 60min, matching server cache TTL). Only on main thread with explicit `querySource`.
- **Mechanism:** Creates new message objects with old compactable tool results replaced by `'[Old tool result content cleared]'`. Keeps the most recent `keepRecent` (default 5, floored at 1).
- **Side effects:** Resets cached MC state (`resetMicrocompactState()`), notifies cache break detector, suppresses compact warning bar.
- **Short-circuits:** If triggered, cached MC is skipped entirely.
- **Config:** `timeBasedMCConfig.ts`, backed by GrowthBook flag `tengu_slate_heron`.

#### 1b. Cached Microcompact (Warm Cache Path)

- **Trigger:** Count-based — when registered compactable tool results exceed `triggerThreshold`, delete all but `keepRecent`. Gated by `feature('CACHED_MICROCOMPACT')`, model support, main-thread source.
- **Mechanism:** Does **not** modify local message content. Tracks tool results in module-level `cachedMCState`, queues `cache_edits` blocks for the API layer. The server deletes tool results from its cached prefix without invalidating it.
- **API integration:** `cache_reference` attributes added to `tool_result` blocks; `cache_edits` blocks inserted into user messages and pinned for re-sending on subsequent calls (see `addCacheBreakpoints()` in `claude.ts`).
- **Scope guard:** Only runs for main thread to prevent forked agents from polluting global state.

#### 1c. Legacy Microcompact (Removed)

The old content-clearing path has been removed. For contexts where cached MC isn't available (external builds, non-ant users, unsupported models, sub-agents), no microcompaction happens and autocompact handles context pressure instead.

### 2. API-Level Context Management (`apiMicrocompact.ts`) — Server-Side

- **Trigger:** Configured at API request construction time, sent as `context_management` parameter.
- **Mechanism:** Server applies edits before token counting. No local message mutation.
- **Strategies:**
  - `clear_thinking_20251015` — Manages thinking block retention. When idle >1h (cache miss), keeps only the last thinking turn. Skipped when redact-thinking is active.
  - `clear_tool_uses_20250919` (ant-only, env-gated) — Two variants: clear tool result content only, or clear entire tool use blocks (excluding Edit/Write/NotebookEdit). Triggers when input tokens exceed 180K.

### 3. Session Memory Compaction (`sessionMemoryCompact.ts`) — Zero-Cost Summary

- **Trigger:** Called first by `autoCompactIfNeeded()` before falling back to full compaction. Requires `tengu_session_memory` and `tengu_sm_compact` feature flags.
- **Mechanism:** Uses pre-extracted session memory content (from the `SessionMemory` subsystem, built asynchronously) as the compaction summary — **no API call needed**.
- **Message selection:** Finds `lastSummarizedMessageId` as the compaction boundary. Keeps at least 10K tokens AND 5 text-block messages, capped at 40K tokens. Uses `adjustIndexToPreserveAPIInvariants()` to avoid splitting tool_use/tool_result pairs or thinking blocks.
- **Fallback:** If post-compact token count still exceeds auto-compact threshold, returns null → full compaction runs instead.

### 4. Full Compaction (`compact.ts`) — API-Based Summarization

- **Trigger:** Manually via `/compact` command, or automatically when `autoCompactIfNeeded()` fires and session memory compaction returns null.
- **Mechanism:** Sends the entire conversation to the Claude API with a summarization prompt (`prompt.ts`). Replaces the conversation with a compact boundary marker + summary message.
- **Post-compact reinjection:** Re-injects up to 5 recently read file attachments (capped at 50K tokens), plan files, skill content, deferred tool announcements, MCP instructions, and agent listings.
- **PTL retry:** If the compaction API call itself hits prompt-too-long, iteratively drops the oldest API-round groups (via `grouping.ts`) and retries up to 3 times.
- **Fork optimization:** Uses `runForkedAgent` to reuse the main conversation's prompt cache for the summarization request. Falls back to regular streaming if the fork fails.
- **Partial compaction:** `partialCompactConversation()` supports two directions:
  - `'from'` — summarize messages after a pivot index, keep earlier ones (preserves prompt cache)
  - `'up_to'` — summarize messages before the pivot, keep later ones (invalidates cache)

### 5. Auto-Compact Orchestrator (`autoCompact.ts`)

- **Trigger:** Called from the query loop **after** each API response. Fires when `tokenCountWithEstimation(messages)` exceeds `effectiveContextWindow - 13,000` tokens.
- **Guards:** Skips for `session_memory`, `compact`, and `marble_origami` (ctx-agent) query sources. Respects `DISABLE_COMPACT`/`DISABLE_AUTO_COMPACT` env vars. Suppressed by reactive-compact-only mode and context-collapse mode.
- **Strategy selection:** Tries session memory compaction first → falls back to full compaction. Circuit breaker after 3 consecutive failures.

## Execution Order in the Query Loop

```
┌─────────────────── Pre-Request ───────────────────┐
│                                                    │
│  microcompactMessages()                            │
│  ├─ Time-based MC fires? → mutate, return          │
│  ├─ Cached MC enabled?   → queue cache_edits       │
│  └─ Neither              → pass through            │
│                                                    │
│  getAPIContextManagement()                         │
│  └─ Configure server-side thinking/tool clearing   │
│                                                    │
│  ─── API Call ───                                  │
│                                                    │
├─────────────────── Post-Response ─────────────────┤
│                                                    │
│  autoCompactIfNeeded()                             │
│  ├─ Under threshold?         → no-op               │
│  ├─ Session memory available? → zero-cost compact   │
│  └─ Otherwise                → full compaction      │
│                                                    │
│  postCompactCleanup() (on any successful compact)  │
│                                                    │
├─────────────────── Manual / Reactive ─────────────┤
│                                                    │
│  /compact command    → compactConversation()        │
│  prompt_too_long err → reactive compact (grouping)  │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Server-Side Cache Layer Structure

The API request prefix is assembled in layers, each with its own cache scope:

| Layer | Cache Scope | Shared Across |
|---|---|---|
| Static system prompt (before `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`) | `global` | All users/orgs on same model |
| Dynamic system prompt (CLAUDE.md, user context) | `org` | Same org |
| Tool definitions | `org` | Same org |
| Message history | `ephemeral` | This session only |

The server matches the **longest matching prefix**. When message-level content diverges, upper layers (system prompt, tools) still hit their respective caches.

## Analysis: Time-Based MC Cache Invalidation

### The Problem

Time-based MC creates new message objects with cleared content via `messages.map()` with spread operators, but **never mutates the REPL's canonical `mutableMessages` array**. The cleared messages only exist within the `queryLoop`'s local `messagesForQuery` variable.

**Evidence chain:**

1. `maybeTimeBasedMicrocompact` returns new objects via `messages.map(message => ({ ...message, ... }))` (microCompact.ts:470-492)
2. `query()` assigns to local: `messagesForQuery = microcompactResult.messages` (query.ts:419)
3. `query()` yields only **new** messages (assistant responses, tool results) back to `QueryEngine`
4. `QueryEngine` pushes yielded messages onto `this.mutableMessages` (QueryEngine.ts:716) — old messages untouched
5. Next user turn: `QueryEngine` passes original `mutableMessages` (with uncleared content) to `query()` again

### The Consequence

On the immediately following call (within the cache window):

1. `evaluateTimeBasedTrigger` returns `null` (gap is small, line 440) → time-based MC does not fire
2. Falls through to cached MC or no-compaction path
3. Messages sent to API contain **original uncleared tool result content**
4. Server cached the **cleared** version from the previous call
5. Message-level cache prefix does not match → **cache break**

### Effective Value

Given the one-shot invalidation pattern:

1. **Reduced cold-cache rewrite cost** — Call N itself sends fewer tokens, reducing cache-creation billing for the session-level portion on a single call
2. **Upper cache layer warming** — System prompt and tool definitions get cached/refreshed as a side effect, benefiting subsequent calls even though the session-level cache breaks
3. **Session-level message cache from call N is effectively single-use** — invalidated on call N+1 when uncleared original content is sent

## Supporting Infrastructure

### Grouping (`grouping.ts`)

Groups messages by API round-trip boundaries (keyed on `message.id`, the API response ID shared across streaming chunks). Used by `truncateHeadForPTLRetry()` for dropping oldest groups when compaction itself hits prompt-too-long.

### Post-Compact Cleanup (`postCompactCleanup.ts`)

Resets all caches invalidated by compaction: microcompact state, context collapse state, `getUserContext` memoization cache, system prompt sections cache, classifier approvals, speculative bash permission checks, beta tracing state, file content attribution cache, session messages cache. Subagent compactions skip main-thread state resets.

### Compact Warning UI (`compactWarningState.ts`, `compactWarningHook.ts`)

Boolean store + React hook for suppressing the "context left until autocompact" warning bar after successful microcompaction. Separated into two files to keep the state module React-free.

### Prompts (`prompt.ts`)

Three summarization prompt variants: full compact (9 sections), partial-from, partial-up-to. All include `NO_TOOLS_PREAMBLE`/`NO_TOOLS_TRAILER` to prevent tool calls in the summarization response. Include an `<analysis>` scratchpad block stripped by `formatCompactSummary()` before entering context.
