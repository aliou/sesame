# @aliou/sesame

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
