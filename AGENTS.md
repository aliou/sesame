# AGENTS.md
- Stack: Node.js (>=22.5) + TypeScript (ESM) + SQLite FTS5; pnpm for package management; Biome v2 for lint/format; vitest for tests.
- Existing rule files in repo: none of CLAUDE.md/.cursorrules/.windsurfrules/.clinerules/.goosehints/.github/copilot-instructions.md.
## Build / lint / test
- Install deps: `pnpm install`
- Build/typecheck gate: `pnpm run build`
- Lint: `pnpm run lint`
- Format/fix: `pnpm run format`
- Run all tests: `pnpm test`
- Run one file: `pnpm test src/utils/date.test.ts`
- Run one test: `pnpm test src/utils/date.test.ts -- -t "Invalid input throws"`
## Release process
- Release automation docs: `docs/releases.md`
- Uses `release-please` + npm publish in `.github/workflows/publish.yml`.
- Follow Conventional Commits for releasable changes (`feat`, `fix`, breaking `!`).

## Architecture / codebase
- `src/sesame.ts`: CLI entrypoint, lazy-dispatches `index|search|status|watch`.
- `src/commands/*-cmd.ts`: CLI arg parsing + user output.
- `src/parsers/pi.ts` + `src/types/session.ts`: parse pi JSONL into normalized turns/tool calls.
- `src/indexer/index.ts` + `src/indexer/format-tool-call.ts`: scan sources, mtime-incremental index, create `message` + `tool_call` chunks.
- `src/storage/db.ts`: schema (`sessions`, `chunks`, `chunks_fts`), BM25 search, filters (`cwd`, date, tool, path, limit).
- `share/pi-extension/src`: pi extension exposing `sesame_search` (`sesame search --json`).
## Style / conventions
- Imports: ESM, use `node:` built-ins, `import type` for types, imports at top (`no-inline-imports`), keep intentional dynamic import in `src/sesame.ts`.
- Formatting: Biome defaults (2 spaces, double quotes, organized imports).
- Types/naming/errors: strict TS, avoid `any` outside tests, camelCase vars/functions + PascalCase types/classes + kebab-case files (`*-cmd.ts`); throw in libs, catch/print/exit at CLI boundary, continue logging per-file/per-line parse/index failures.
