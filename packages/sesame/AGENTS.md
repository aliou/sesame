# AGENTS.md — @aliou/sesame

Published library. The source of truth for parsing, indexing, and searching pi sessions.

## Package role

- Parses pi JSONL session files into normalized turns and tool calls.
- Indexes sessions into SQLite FTS5 with mtime-incremental updates.
- Exposes BM25 search with filters (cwd, date, tool, path).
- Uses `node:sqlite` (built-in, no external SQLite dep).

## Key files

- `index.ts`: public API surface — only export things from here.
- `parsers/pi.ts` + `types/session.ts`: JSONL → normalized session/turns/tool calls.
- `indexer/index.ts`: scan → parse → upsert. Mtime-incremental by default.
- `indexer/format-tool-call.ts`: formats tool call content for FTS indexing.
- `storage/db.ts`: schema, migrations, `search()`, session CRUD.
- `storage/migrations/`: numbered migration files; add new ones here.
- `utils/config.ts`: load `~/.config/sesame/config.jsonc`.
- `utils/xdg.ts`: XDG path helpers.
- `utils/date.ts`: relative/absolute date parsing.
- `test-helpers/session-factory.ts`: factory helpers for tests (not exported publicly).

## Build

- `pnpm run build`: `tsc` — emits to `dist/`.
- `pnpm run typecheck`: `tsc --noEmit`.
- `pnpm test`: vitest.

## Conventions

- All public exports go through `index.ts`. Do not add deep imports.
- Throw errors in library code; never call `process.exit()`.
- Migration files are numbered (`001-`, `002-`, …); always add a new file, never edit existing ones.
- `test-helpers/` is excluded from the published `dist/` via `.npmignore`.
