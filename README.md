# sesame

Search coding-agent sessions with local BM25 full-text search (SQLite FTS5).

Sesame indexes Pi JSONL session files locally and lets you search them with ranked session, project, date, tool, path, and skill filters.

## What it does

- indexes Pi session files from `~/.pi/agent/sessions` by default
- stores normalized session/chunk data in SQLite under Sesame's XDG data directory
- supports ranked keyword/topic search with SQLite FTS5 + BM25
- supports listing recent sessions with `sesame search` or `sesame search "*"`
- supports tool-oriented filters (`--tools`, `--tool`, `--path`)
- supports skill filters (`--skill`, `--skill-path`) plus a `sesame skills` leaderboard
- supports filesystem watch mode and interval polling

## Installation

### Homebrew

```bash
brew tap aliou/toolbox
brew install sesame
```

### From source

Requires Node.js 26 or newer and pnpm.

## Quickstart (repo)

```bash
pnpm install
pnpm run build
```

`pnpm run build` bundles the CLI into `packages/cli/dist/sesame.cjs`. Use `pnpm run dev` to rebuild on change.

Index sessions:

```bash
./packages/cli/dist/sesame.cjs index
```

Search:

```bash
./packages/cli/dist/sesame.cjs search "nix infra simplify"
./packages/cli/dist/sesame.cjs search "package.json exports" --tools --tool write
./packages/cli/dist/sesame.cjs search "*" --skill vitest
./packages/cli/dist/sesame.cjs search --after 7d
```

List skills used across sessions:

```bash
./packages/cli/dist/sesame.cjs skills
```

Check index:

```bash
./packages/cli/dist/sesame.cjs status
```

Watch for changes:

```bash
./packages/cli/dist/sesame.cjs watch
./packages/cli/dist/sesame.cjs watch --interval 30
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
