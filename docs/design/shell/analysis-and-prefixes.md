# PowerShell analysis, prefixes, and shared flag validation

Sources: [powershell/parser.ts](../../../utils/powershell/parser.ts), [powershell/staticPrefix.ts](../../../utils/powershell/staticPrefix.ts), [powershell/dangerousCmdlets.ts](../../../utils/powershell/dangerousCmdlets.ts), [bash/prefix.ts](../../../utils/bash/prefix.ts), [shell/prefix.ts](../../../utils/shell/prefix.ts), [shell/specPrefix.ts](../../../utils/shell/specPrefix.ts), [bash/registry.ts](../../../utils/bash/registry.ts), and [shell/readOnlyCommandValidation.ts](../../../utils/shell/readOnlyCommandValidation.ts).

## PowerShell parser subprocess

Unlike the in-process Bash parser, `parsePowerShellCommand` launches PowerShell to use its language parser. That subprocess executes a controlled parsing script; the requested command is encoded data for `Parser.ParseInput`, not executed as the requested operation. The later [execution provider](./providers.md) launches a separate process for actual execution.

```mermaid
sequenceDiagram
    participant V as Permission or prefix caller
    participant P as parsePowerShellCommand
    participant C as PowerShell parsing child
    V->>P: Command text
    P->>P: Check UTF-8 byte length and cached executable
    P->>P: Encode command as data; encode parser script for transport
    P->>C: NoProfile, NonInteractive, NoLogo, EncodedCommand
    C->>C: ParseInput and serialize AST evidence as JSON
    C-->>P: JSON or process failure
    alt Timeout on first attempt
        P->>C: Retry parsing once
        C-->>P: JSON or failure
    end
    P->>P: Transform JSON to statements, commands, redirects, flags
    P-->>V: ParsedPowerShellCommand with valid/errors
```

### Source-order stages

1. Enforce platform-dependent `MAX_COMMAND_LENGTH` using UTF-8 bytes, not JS string length. The Windows bound accounts for encoded command-line overhead.
2. Resolve the cached executable; absence yields invalid result `NoPowerShell`.
3. `buildParseScript` Base64-encodes user text as UTF-8 data in a variable. The enclosing parser program is encoded as UTF-16LE for `-EncodedCommand`.
4. Invoke execa with timeout and `reject: false`. Retry once only on timeout. Spawn exception, final timeout, nonzero exit, empty output, and invalid JSON each become an invalid result with a distinct error ID.
5. Transform raw statements, pipeline elements, arguments, redirects, variables, and security flags. `ensureArray` handles PowerShell JSON singleton unwrapping.
6. Cache command-keyed promises with a 256-entry LRU. Transient process/JSON failures are evicted after settlement; deterministic syntax/length results remain cached. This cache has no caller AbortSignal parameter.

`ParsedCommandElement` preserves command name classification, source text, argument strings, element types, and child metadata for colon-bound parameter arguments. Consumers must inspect dynamic element types; an expression is not made safe by its string rendering. Helpers expose all commands, nested commands/redirections, pipeline segments, directory changes, argument abbreviations, null targets, and derived security flags.

`COMMON_ALIASES` is a static mapping, not a live query of profile aliases. `dangerousCmdlets.ts` groups execution, module-loading, network, alias mutation, WMI/CIM, and argument-sensitive cmdlets and derives `NEVER_SUGGEST` with aliases. These sets support consumers; they do not independently execute or deny a command.

## Static prefix suggestions

Prefix extraction supplies candidate text for persistent permission rules. It does not run the command or replace permission checks.

### Bash

`getCommandPrefixStatic` uses `parseCommand`, extracts the first command's arguments and leading environment assignments, and looks up a command spec. Recognized wrappers recursively locate the inner command; wrapper depth above two or recursion above ten stops extraction. Known subcommands disambiguate specs that also describe embedded commands. The result may be outer null (unable to extract) or `{commandPrefix: null}` (no candidate).

`getCompoundCommandPrefixesStatic` splits with the legacy command splitter, optionally excludes already-allowed commands, groups candidates by first word, and collapses each group using word-aligned common prefixes. The Bash implementation can collapse a group to the bare root; it does not have the additional PowerShell guard below.

### PowerShell

Static extraction reuses parsed `CommandAst` elements, including nested commands. It rejects path-like application invocations and `NEVER_SUGGEST` names. Cmdlets generally suggest their name; external commands must pass literal-element guards before shared spec processing. This keeps dynamic variables/subexpressions out of a purported stable prefix.

Compound extraction accepts an exclusion callback over structured elements, avoiding another parser subprocess per subcommand. Grouping/comparison is case-insensitive while preserving first-seen spelling. If a group's common prefix collapses to a bare root whose spec has subcommands or whose depth rule requires more structure, that group is dropped.

### Shared spec walker

`registry.getCommandSpec` caches local overrides first, then optional `@withfig/autocomplete` imports. Import lookup rejects path separators, `..`, and unsuitable leading dashes. Local specs cover alias, nohup, pyright, sleep, srun, time, and timeout; unavailable imports return null.

`specPrefix.buildPrefix` determines maximum depth from explicit rules and spec structure, then walks arguments. It skips applicable global flags to find subcommands, includes command/module-bearing options, stops at other flags or transient/path-like arguments, and handles leaf/subcommand/wrapper depth differently. These are suggestions based on static metadata, not validation of executable behavior.

## Model-assisted prefix extraction

`shell/prefix.ts` supplies factories used by Bash command helpers and other consumers. `createCommandPrefixExtractor` installs a 200-entry command-keyed LRU around a model query; its key omits signal and session-mode parameters, so concurrent requests for the same text share the promise. Rejected entries are evicted with an identity check so an older rejection cannot remove a newer cached promise.

`getCommandPrefixImpl` returns null in tests, allows a configured precheck to short-circuit, starts a ten-second warning timer, then calls `queryHaiku` with a policy specification. It accepts only a response that actually prefixes the input and rejects bare git, dangerous shell prefixes, `none`, and the injection-detection marker. API-error text returns no result; rejection clears the warning timer and propagates. The warning timer reports latency; it is not itself an execution timeout.

The subcommand factory adds command splitting and per-subcommand results with the same bounded promise-cache/rejection pattern. Static and model-assisted extractors are separate APIs; there is no implied unconditional fallback order for every caller.

## Shared read-only argument checks

`readOnlyCommandValidation.ts` provides external-program configuration tables (including git, gh, docker, ripgrep, and pyright) and `validateFlags`. Bash and PowerShell callers share these after producing tokens through their own parsers.

The flag walker recognizes allowed flags, validates value types, handles supported attached values and command-specific numeric forms, and optionally checks xargs target commands. `--` only ends flag parsing for programs configured to respect it. The presence of `=` is tracked separately from whether its value is empty, preventing accidental consumption of the next token. Additional danger callbacks can reject otherwise recognized flag combinations.

`containsVulnerableUncPath` is Windows-gated and examines UNC/WebDAV-like forms. A successful flag check does not settle path permissions, redirects, substitutions, runtime aliases, or sandbox eligibility. Those decisions remain in the [Bash permission system](../tools/shell-repl-internal-execution/BashTool/permissions.md) and [PowerShell tool](../tools/shell-repl-internal-execution/PowerShellTool/internals.md).
