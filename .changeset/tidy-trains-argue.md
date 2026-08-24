---
"@aliou/sesame": minor
---

Search sessions by tool call parameters.

Allowlisted tool call parameters are now extracted at index time into a new `tool_call_args` table (migration 7), powering parameter-level filters:

- `SearchOptions` and `ListSessionsOptions` gain `toolArgs: ToolArgFilter[]` — each `{ tool, key, value }` filter is an `EXISTS` check (AND across filters, `value` matched as a substring)
- Library exports `TOOL_ARG_ALLOWLIST`, `isAllowedToolArg`, `extractToolArgs`, and the `ToolArgFilter` type
- CLI gains a repeatable `--arg tool:key=value` flag that validates against the allowlist (e.g. `sesame search --arg find:pattern=useStorage`)

The allowlist covers pi's native tools (`bash`, `read`, `write`, `edit`, `find`, `grep`, `ls`) plus custom harness tools (`find_sessions`, `list_sessions`, `read_session`, `read_url`, `synthetic_web_search`, `process`). Migration 7 invalidates stored mtimes so the next index backfills existing sessions.
