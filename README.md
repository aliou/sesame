# sesame

Search coding-agent sessions with local BM25 full-text search (SQLite FTS5).

## What it does

- indexes session files (currently pi JSONL)
- stores normalized session/chunk data in SQLite
- supports concept-style search beyond exact grep
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

Package includes:

- skill: `skills/sesame/SKILL.md`
- extension tool: `sesame_search` under `share/pi-extension/src`

## Development

```bash
pnpm run lint
pnpm test
pnpm run typecheck
```
