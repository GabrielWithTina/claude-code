# Application state

The application state layer supplies shared session state to both the React/Ink
UI and headless execution. Its schema and defaults live in
[`state/AppStateStore.ts`](../../../state/AppStateStore.ts); its update and
subscription implementation lives in [`state/store.ts`](../../../state/store.ts).

| Document | Scope |
|---|---|
| [AppStateStore internals](./app-state-store-internals.md) | State schema, default initialization, store update ordering, React selectors, headless access, settings synchronization, side effects, and failure behavior. |

Related documents: [REPL](../repl.md), [QueryEngine](../query-engine.md),
[command queue](../command-queue-internals.md), and
[configuration storage](../storage-config-settings.md).
