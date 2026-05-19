# sesame

Search coding-agent sessions with local BM25 full-text search (SQLite FTS5).

Sesame indexes Pi JSONL session files locally and lets you search them with ranked session, project, date, tool, and path filters.

## What it does

- indexes Pi session files from `~/.pi/agent/sessions` by default
- stores normalized session/chunk data in SQLite under Sesame's XDG data directory
- supports ranked keyword/topic search with SQLite FTS5 + BM25
- supports listing recent sessions with `sesame search "*"`
- supports tool-oriented filters (`--tools`, `--tool`, `--path`)
- supports filesystem watch mode and interval polling

## Installation

### Homebrew

```bash
brew tap aliou/toolbox
brew install sesame
```

### From source

Requires Node.js 25 or newer and pnpm.

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

Watch for changes:

```bash
pnpm run dev watch
pnpm run dev watch --interval 30
```

## Configuration

Sesame reads `~/.config/sesame/config.jsonc` by default and creates it if missing:

```json
{
  "piSessionPaths": ["~/.pi/agent/sessions"]
}
```

The SQLite index is stored at `~/.local/share/sesame/index.sqlite` by default on macOS/Linux. Sesame also respects `SESAME_*_DIR` and XDG directory environment variables.

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
