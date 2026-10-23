# sesame

Search your past coding-agent sessions. Sesame indexes Pi JSONL session files into a local SQLite FTS5 index and ranks results with BM25, so you can find the session where you fixed that bug or touched that file.

- Ranked full-text search, or browse recent sessions with no query.
- Filters by project directory, date, tool call, file path, and skill.
- A `sesame skills` leaderboard of the skills your sessions loaded.
- Watch mode keeps the index current.
- Everything stays local.

## Install

With Nix, using the release binaries for macOS (arm64) and Linux (arm64, x64):

```bash
nix profile install github:aliou/sesame
```

Binaries are also attached to each [CLI release](https://github.com/aliou/sesame/releases) (tags `@aliou/sesame-cli@<version>`). To use Sesame as a library, see [`@aliou/sesame`](./packages/sesame/README.md).

## Usage

```bash
sesame index
sesame search "nix infra simplify"
sesame search "package.json exports" --tools --tool write
sesame search "*" --skill vitest
sesame search --after 7d
sesame skills
sesame status
sesame watch
```

`sesame --help` and `sesame <command> --help` list every flag. Full reference: [`docs/cli-usage.md`](./docs/cli-usage.md).

## Configuration

Sesame reads `~/.config/sesame/config.jsonc` and creates it if missing:

```json
{
  "piSessionPaths": ["~/.pi/agent/sessions"]
}
```

The index lives at `~/.local/share/sesame/index.sqlite`. `SESAME_DATA_DIR`, `SESAME_CONFIG_DIR`, `SESAME_CACHE_DIR`, `SESAME_RUNTIME_DIR`, and the XDG variables override the default directories.

## Pi skill

`skills/sesame/SKILL.md` teaches a Pi agent to search its own past sessions with the CLI:

```bash
pi install git:github.com/aliou/sesame
```

## Development

Requires Node.js 26 or newer and pnpm (`nix develop` provides both).

```bash
pnpm install
pnpm run build        # CLI bundle at packages/cli/dist/sesame.cjs
pnpm run lint
pnpm run typecheck
pnpm test
```

How indexing works: [`docs/indexing.md`](./docs/indexing.md). All docs: [`docs/README.md`](./docs/README.md).
