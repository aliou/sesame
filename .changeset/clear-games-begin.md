---
"@aliou/sesame-cli": minor
---

CLI updates: fuzzy skills, tool-arg filters, and clig.dev conventions.

- `sesame search --skill <text>` falls back to fuzzy matching over skill names and descriptions when the text is not an exact skill name
- `sesame search --arg tool:key=value` filters by allowlisted tool call parameters (repeatable, validated loudly)
- `sesame skills --source` becomes `--actor user|agent` and prints each skill's latest known description
- New `--version`/`-V` (global and per-command), per-command `--help`/`-h`, loud errors for unknown options and missing flag values, and `--limit`/`--interval` validation as positive integers

After upgrading, run `sesame index` once: migrations 5-7 invalidate stored mtimes, so this pass re-parses every session and backfills skill actors, the skill catalog, and tool arguments.
