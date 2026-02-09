---
name: sesame
description: Search past coding sessions using Sesame's BM25 full-text search. Use when you need to find previous sessions by topic, concept, or keyword -- especially multi-word queries that find_sessions struggles with.
---

# Sesame - Session Search

Sesame indexes coding agent sessions into a SQLite FTS5 database for BM25 full-text search. It finds sessions by topic, concept, or keyword without requiring exact phrase matches.

## When to Use Sesame vs find_sessions

Use **sesame** for multi-word concept queries:
- "nix infrastructure simplify"
- "carousel company website"
- "CI pipeline publish release workflow"

Use **find_sessions** for single exact keywords or proper nouns:
- "Fizen", "bird", "grit"

## CLI Usage

Search sessions:
```bash
sesame search "query"
sesame search "query" --json          # JSON output
sesame search "query" --cwd /path     # Filter by project directory
sesame search "query" --after 7d      # Sessions from last 7 days
sesame search "query" --before 2026-01-01
sesame search "query" --limit 5
```

Index sessions (run before first search, or to pick up new sessions):
```bash
sesame index          # Incremental (only new/changed files)
sesame index --full   # Full rebuild
```

Check index status:
```bash
sesame status
```

## Workflow

1. If search returns no results, run `sesame index` first to ensure the index is up to date.
2. Use `--json` when you need structured data for further processing.
3. Results are ranked by BM25 relevance. The score (0-1) indicates match quality.
4. The matched snippet shows the most relevant chunk from each session.

## Date Filters

Relative dates: `7d` (7 days), `2w` (2 weeks), `1m` (1 month).
Absolute dates: ISO format like `2026-01-15`.
