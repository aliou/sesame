# AGENTS.md
- Stack: Node.js (>=25) + TypeScript (ESM) + SQLite FTS5; pnpm for package management; Biome v2 for lint/format; vitest for tests.
- Existing rule files in repo: none of CLAUDE.md/.cursorrules/.windsurfrules/.clinerules/.goosehints/.github/copilot-instructions.md.
## Build / lint / test
- Install deps: `pnpm install`
- Build/typecheck gate: `pnpm run build`
- Lint: `pnpm run lint`
- Format/fix: `pnpm run format`
- Run all tests: `pnpm test`
- Run one file: `pnpm test --filter @aliou/sesame -- packages/sesame/utils/date.test.ts`
- Run one test: `pnpm test --filter @aliou/sesame -- packages/sesame/utils/date.test.ts -t "Invalid input throws"`
- Git hooks (Husky): pre-push runs `check:lockfile`, `lint`, `typecheck`.
## Architecture / codebase
This is a pnpm monorepo. Packages live under `packages/`:
- `packages/sesame/`: `@aliou/sesame` — the publishable library. Parses pi JSONL, indexes into SQLite FTS5, exposes BM25 search.
  - `packages/sesame/index.ts`: library entry point.
  - `packages/sesame/parsers/pi.ts` + `packages/sesame/types/session.ts`: parse pi JSONL into normalized turns/tool calls.
  - `packages/sesame/indexer/index.ts` + `packages/sesame/indexer/format-tool-call.ts`: scan sources, mtime-incremental index, create `message` + `tool_call` chunks.
  - `packages/sesame/storage/db.ts`: schema (`sessions`, `chunks`, `chunks_fts`), BM25 search, filters (`cwd`, date, tool, path, limit).
- `packages/cli/`: `@aliou/sesame-cli` — the CLI (private, not published to npm). Depends on `@aliou/sesame`.
  - `packages/cli/sesame.ts`: CLI entrypoint, lazy-dispatches `index|search|status|watch`.
  - `packages/cli/commands/*-cmd.ts`: CLI arg parsing + user output.
  - `packages/cli/tsdown.config.ts`: tsdown config for building the Node SEA binary.
- `packages/skills/sesame-cli/`: `@aliou/sesame-skill-cli` — pi skill for the Sesame CLI (search, index, status, watch usage). Private, not published to npm.
## Docs map
- `README.md`: project overview + quickstart.
- `docs/cli-usage.md`: CLI commands/flags/examples.
- `docs/indexing.md`: parser/indexer/chunking/schema behavior.
- `docs/library-usage.md`: exported API and programmatic usage.
- `docs/README.md`: docs index.
## Style / conventions
- Imports: ESM, use `node:` built-ins, `import type` for types, imports at top (`no-inline-imports`), keep intentional dynamic import in `packages/cli/sesame.ts`.
- Formatting: Biome defaults (2 spaces, double quotes, organized imports).
- Types/naming/errors: strict TS, avoid `any` outside tests, camelCase vars/functions + PascalCase types/classes + kebab-case files (`*-cmd.ts`); throw in libs, catch/print/exit at CLI boundary, continue logging per-file/per-line parse/index failures.
