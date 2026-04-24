# sesame

Search coding-agent sessions with local BM25 full-text search (SQLite FTS5).

Sesame indexes coding-agent session files locally and lets you search them with ranked session and tool filters.

## What it does

- indexes session files (currently pi JSONL)
- stores normalized session/chunk data in SQLite
- supports ranked keyword/topic search with SQLite FTS5 + BM25
- supports tool-oriented filters (`--tools`, `--tool`, `--path`)

## Quickstart (repo)

```bash
pnpm install
pnpm run build
```

Index sessions:

```bash
pnpm run dev index
```

Search:

```bash
pnpm run dev search "nix infra simplify"
pnpm run dev search "package.json exports" --tools --tool write
pnpm run dev search "*" --limit 20
```

Check index:

```bash
pnpm run dev status
```

## CLI docs

See [`docs/cli-usage.md`](./docs/cli-usage.md).

## Internals docs

- indexing flow: [`docs/indexing.md`](./docs/indexing.md)
- library/API usage: [`docs/library-usage.md`](./docs/library-usage.md)
- docs index: [`docs/README.md`](./docs/README.md)

## Pi integration

Monorepo package:

- `skills/sesame/SKILL.md`: pi skill for the Sesame CLI.

## Development

```bash
pnpm run lint
pnpm test
pnpm run typecheck
```
