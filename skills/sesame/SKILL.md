---
name: sesame
description: Search past coding sessions with Sesame local BM25 search. Use for ranked multi-word queries, tool-call searches, or listing recent sessions when exact lookup is too strict.
---

# Sesame - Session Search

Sesame indexes coding agent sessions into SQLite FTS5 and ranks results with BM25.

## When to use

Use **sesame** when you need:
- Multi-word topic search (`"nix infra cleanup"`, `"publish workflow changesets"`)
- Tool-call oriented search (`--tools`, `--tool bash`, `--path package.json`)
- Skill-oriented search (`--skill vitest`, `--skill-path /skill-library/`)
- Session discovery / paging (no query or `"*"` with filters and `--exclude`)

Use **find_sessions** for quick exact keyword lookups.
Use **read_session** after you identified the session to inspect.

## CLI

### Search

```bash
sesame search "query"
sesame search --after 7d
sesame search "query" --json
sesame search "query" --cwd /path/to/project
sesame search "query" --after 7d
sesame search "query" --before 2026-01-01
sesame search "query" --limit 5
sesame search "query" --tools
sesame search "query" --tool bash
sesame search "query" --path package.json
sesame search "query" --skill vitest
sesame search "query" --skill-path /skill-library/
sesame search "query" --exclude <session-id> --exclude <session-id>
```

Special query to list sessions instead of full-text match:

```bash
sesame search "*" --limit 20
sesame search "*" --cwd /path --after 2w --exclude <session-id>
```

### Skills

```bash
sesame skills
sesame skills --after 1m --source invocation
sesame skills --cwd /path/to/project --json
```

Lists skills used across indexed sessions with session counts, most used first. Use it to find the exact name for `--skill`.

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
2. If results are empty or stale, run `sesame index` or keep `sesame watch` running.
3. Narrow using `--cwd`, `--after`, `--before`, `--tools`, `--tool`, `--path`, `--skill`, or `--skill-path`.
4. To answer "which sessions used skill X", run `sesame skills` to get the name, then `sesame search "*" --skill <name>`.
4. Use `--exclude` to page through additional results across repeated searches.
5. Use `--json` when another tool/agent needs structured output.

## Date formats

- Relative: `7d`, `2w`, `1m`
- Absolute: `YYYY-MM-DD` (ISO date)

## Notes

- Multi-word searches use all terms first, then any-term fallback only when filters leave no strict matches. JSON output includes `matchMode` and matching entry provenance.
- Date filters use each session's modification time.
- Titles and active checkpoints are searchable. Discovery-tool result bodies are not indexed.
- Skill usage is detected two ways: injected `?skill-name` blocks (`source: invocation`) and `SKILL.md` reads (`source: read`). `--skill` matches the skill directory name exactly, case-insensitively. Search output lists each result's skills.
- Scores are normalized to `0.00-1.00` for display. Higher is better.
- `sesame watch` runs an initial index pass, then re-indexes on change.
