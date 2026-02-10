# AGENTS.md
- Stack: Bun + TypeScript (ESM) + SQLite FTS5; Biome v2 for lint/format.
- Existing rule files in repo: none of CLAUDE.md/.cursorrules/.windsurfrules/.clinerules/.goosehints/.github/copilot-instructions.md.
## Build / lint / test
- Install deps: `bun install`
- Build/typecheck gate: `bun run build`
- Lint: `bun run lint`
- Format/fix: `bun run format`
- Run all tests: `bun test` (same as `bun run test`)
- Run one file: `bun test src/utils/date.test.ts`
- Run one test: `bun test src/utils/date.test.ts -t "Invalid input throws"`
- Build release binaries: `bun run build:binary`
## Architecture / codebase
- `src/sesame.ts`: CLI entrypoint, lazy-dispatches `index|search|status`.
- `src/commands/*-cmd.ts`: CLI arg parsing + user output.
- `src/parsers/pi.ts` + `src/types/session.ts`: parse pi JSONL into normalized turns/tool calls.
- `src/indexer/index.ts` + `src/indexer/format-tool-call.ts`: scan sources, mtime-incremental index, create `message` + `tool_call` chunks.
- `src/storage/db.ts`: schema (`sessions`, `chunks`, `chunks_fts`), BM25 search, filters (`cwd`, date, tool, path, limit).
- `share/pi-extension/src`: pi extension exposing `sesame_search` (`sesame search --json`).
## Style / conventions
- Imports: ESM, use `node:` built-ins, `import type` for types, imports at top (`no-inline-imports`), keep intentional dynamic import in `src/sesame.ts`.
- Formatting: Biome defaults (2 spaces, double quotes, organized imports).
- Types/naming/errors: strict TS, avoid `any` outside tests, camelCase vars/functions + PascalCase types/classes + kebab-case files (`*-cmd.ts`); throw in libs, catch/print/exit at CLI boundary, continue logging per-file/per-line parse/index failures.
