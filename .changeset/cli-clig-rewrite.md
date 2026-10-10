---
"@aliou/sesame-cli": minor
---

Rewrite the CLI layer on Brocli, following clig.dev and the sbxctl conventions.

New:

- Global flags on every command, before or after it: `-o/--output human|json` (`-j`/`--json` alias), `--pretty`, `--compact`, `-q/--quiet`, `--no-color` (also `NO_COLOR`), `--debug`.
- `-o json` for `index`, `status`, and `watch`, in addition to `search` and `skills`.
- `sesame help <topic>` for `config`, `json`, `exit-codes`, `completion`, `agent-guide`.
- Shell completion: `sesame completion <bash|zsh|fish|powershell>`, with skill names from the local index for `--skill`. The Nix package installs the bash, zsh, and fish scripts.
- `--flag=value` syntax, and a stderr hint to run `sesame index` when a search finds nothing in an empty index.

Breaking:

- Usage errors exit 2 instead of 1. `sesame index` exits 3 when some session files fail to index.
- Errors print as `CODE: message`, or as `{"error":{"code","message"}}` on stderr in JSON mode.
- `-V` is gone. Use `-v` or `--version`.
- `sesame search a b` is a usage error. Quote multi-word queries.
- JSON output is single-line when piped. Use `--pretty` to indent.
- `sesame index` writes progress to stderr. Its stdout summary is now aligned fields.
- `sesame watch` prints a text line per event on stdout by default. Use `-o json` for the previous one-JSON-object-per-line output.
- `sesame status` output is now aligned fields.
