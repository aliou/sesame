# @aliou/sesame

## 0.5.1

### Patch Changes

- 02e34af: Add `--exclude` support to search and apply SQL-level session exclusion in both wildcard and FTS paths so `limit` behaves correctly.

## 0.5.0

### Minor Changes

- 54b7450: Add schema_migrations table for lightweight DB migrations. Replaces inline ALTER TABLE with a tracked migration system using sequential migration files.
- ca7cb24: Add tool call success/failure status to index and search. New `is_error` column on chunks, `status` search filter, and `toolName`/`toolsOnly` now work with wildcard queries.

## 0.4.0

### Minor Changes

- 9b03f3c: Support `*` query to list all sessions with filters. When searching with `*`, returns all sessions ordered by modification date (newest first), respecting cwd/after/before/limit filters. Default limit of 10 ensures context safety.

## 0.3.1

### Patch Changes

- 73b298b: Fix SQLite runtime compatibility by selecting `node:sqlite` on Node and `bun:sqlite` on Bun, so Bun-compiled binaries no longer crash on startup. Also add a CLI integration test that builds and runs the Bun binary, plus test config isolation so Vitest only runs Node unit tests while Bun runs CLI binary tests.

## 0.3.0

### Minor Changes

- 0a0f66b: Add watch command for daemon-mode indexing

## 0.2.0

### Minor Changes

- 8beab04: Migrate runtime from Bun APIs to Node.js APIs and switch project workflows to pnpm while keeping Bun only for binary builds.

  Key updates:

  - use `node:sqlite` instead of `bun:sqlite`
  - replace Bun file APIs with Node fs APIs
  - run tests with Vitest
  - use pnpm lockfile/workflows in CI and release pipelines
  - keep `build:binary` on Bun for compiled binaries

### Patch Changes

- 2c99cb6: Enable TypeScript type emission by removing `allowImportingTsExtensions` and setting `noEmit: false`

## 0.1.0

### Minor Changes

- c0e3f3e: Initial release: BM25 full-text search over coding agent sessions.

  - Pi JSONL session parser with support for messages, tool calls, and compaction summaries
  - SQLite + FTS5 storage with BM25 ranking and porter stemming
  - CLI commands: index, search, status
  - Search filters: --cwd, --after, --before, --limit, --tools, --tool, --path
  - Tool call indexing with structured text formatting
  - Pi extension (sesame_search tool) and skill file
  - JSON and human-readable output formats
