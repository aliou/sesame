# AGENTS.md
- Stack: Node.js (>=22.5) + TypeScript (ESM) + SQLite FTS5; pnpm workspaces monorepo; Biome v2 for lint/format; vitest for tests.
- Existing rule files in repo: none of CLAUDE.md/.cursorrules/.windsurfrules/.clinerules/.goosehints/.github/copilot-instructions.md.
## Build / lint / test
- Install deps: `pnpm install`
- Build all packages: `pnpm run build`
- Lint: `pnpm run lint`
- Format/fix: `pnpm run format`
- Run all tests: `pnpm test`
- Run one file: `pnpm --filter @aliou/sesame test packages/sesame/utils/date.test.ts`
- Git hooks (Husky): pre-push runs `check:lockfile`, `lint`, `typecheck`.
## Monorepo structure
- `packages/sesame/`: Library package (`@aliou/sesame`), published to npm.
- `packages/cli/`: CLI package (`@aliou/sesame-cli`), private, binary built on release.
- Root: shared config (biome, husky, changeset), workflows, docs.
## Architecture / codebase
### Library (`packages/sesame/`)
- `index.ts`: library entry point, re-exports public API.
- `parsers/pi.ts` + `types/session.ts`: parse pi JSONL into normalized turns/tool calls.
- `indexer/index.ts` + `indexer/format-tool-call.ts`: scan sources, mtime-incremental index, create `message` + `tool_call` chunks.
- `storage/db.ts`: schema (`sessions`, `chunks`, `chunks_fts`), BM25 search, filters (`cwd`, date, tool, path, limit).
### CLI (`packages/cli/`)
- `sesame.ts`: CLI entrypoint, lazy-dispatches `index|search|status|watch`.
- `commands/*-cmd.ts`: CLI arg parsing + user output. Imports from `@aliou/sesame`.
- `bin/sesame`: shell wrapper for development.
- `build.ts`: builds platform-specific binaries with Bun.
### Other
- `share/pi-extension/src`: pi extension exposing `sesame_search` (`sesame search --json`).
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
