---
name: sesame
description: Search past coding sessions with Sesame BM25 search. Use for multi-word topic queries, tool-call searches, or listing recent sessions when find_sessions is too strict.
---

# Sesame - Session Search

Sesame indexes coding agent sessions into SQLite FTS5 and ranks results with BM25.

## When to use

Use **sesame** when you need:
- Multi-word topic search (`"nix infra cleanup"`, `"publish workflow changesets"`)
- Tool-call oriented search (`--tools`, `--tool bash`, `--path package.json`)
- Session discovery / paging (`"*"` with filters and `--exclude`)

Use **find_sessions** for quick exact keyword lookups.
Use **read_session** after you identified the session to inspect.

## CLI

### Search

```bash
sesame search "query"
sesame search "query" --json
sesame search "query" --cwd /path/to/project
sesame search "query" --after 7d
sesame search "query" --before 2026-01-01
sesame search "query" --limit 5
sesame search "query" --tools
sesame search "query" --tool bash
sesame search "query" --path package.json
sesame search "query" --exclude <session-id> --exclude <session-id>
```

Special query to list sessions instead of full-text match:

```bash
sesame search "*" --limit 20
sesame search "*" --cwd /path --after 2w --exclude <session-id>
```

### Index / status / watch

```bash
sesame index
sesame index --full
sesame status
sesame watch
sesame watch --interval 30
```

## Practical workflow

1. Run `sesame search "query"`.
2. If results are empty or stale, run `sesame index`.
3. Narrow using `--cwd`, `--after`, `--before`, `--tools`, `--tool`, or `--path`.
4. Use `--exclude` to page through additional results across repeated searches.
5. Use `--json` when another tool/agent needs structured output.

## Date formats

- Relative: `7d`, `2w`, `1m`
- Absolute: `YYYY-MM-DD` (ISO date)

## Notes

- Scores are normalized to `0.00-1.00` for display. Higher is better.
- `sesame watch` runs an initial index pass, then re-indexes on change.
- The `sesame_search` pi extension tool exposes only: `query`, `cwd`, `after`, `before`, `limit`.
