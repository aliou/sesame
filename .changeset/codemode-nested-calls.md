---
"@aliou/sesame": minor
"@aliou/sesame-cli": minor
---

Index tool calls that run nested inside pi's codemode tool. Nested calls recorded on a codemode result (`nestedCalls`, falling back to `details.calls`) become regular tool_call chunks under their own tool name with a new `via` column set to the parent tool, so path/arg filters and SKILL.md read detection apply to them. Search and session listing accept a `via` filter; the CLI grows `--via <name>` (e.g. `--tool read --via codemode` finds files read inside codemode scripts). Codemode results wrapping only discovery tools (`find_sessions`, `list_sessions`, `read_session`) stay out of the index like direct discovery results. Migration 009 adds `chunks.via`; re-index with `sesame index --full` to backfill.
