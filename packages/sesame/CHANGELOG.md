# @aliou/sesame

## 0.9.0

### Minor Changes

- dc5e9aa: Library changes:

  - Add `listSessions` and `getSession` to the public library API.
  - Keep the parser and indexing flow explicitly Pi-only after the workspace split.
  - Refresh the Sesame skill and usage documentation.

  CLI changes:

  - Bundle `@aliou/sesame` into the standalone SEA binary.
  - Replace lazy dynamic command imports with static imports in the CLI entrypoint.
  - Refresh CLI help, metadata, and usage documentation.
  - Split release automation so the library publishes to npm and the CLI creates its own GitHub release with binaries.

  Repository changes:

  - Split the project into `@aliou/sesame` and private `@aliou/sesame-cli` workspace packages.
  - Upgrade Biome and lint plugins.
  - Remove the unused Pi extension package.

## 0.8.0

### Minor Changes

- 9ef404e: allow searching "" to list sessions

## 0.7.1

### Patch Changes

- e99835f: Prevent sqlite lock contention during indexing by adding a cross-process index lock and serializing watch-triggered reindex runs. Also add tests for lock behavior and watch queue serialization.

## 0.7.0

### Minor Changes

- 54d0fca: Migrate from Bun to Node 25 + tsdown SEA for binary builds.

  - Replace `bun:sqlite` with `node:sqlite` as the sole SQLite backend.
  - Replace `bun build --compile` with tsdown exe (Node SEA) for standalone binaries.
  - Migrate CLI tests from `bun:test` to vitest.
  - Bump minimum Node version to `>=25.0.0`.
  - CI builds binaries for linux-x64, linux-arm64, and darwin-arm64 via matrix strategy.

### Patch Changes

- cc89035: Fix legacy SQLite migration order so tree indexes are created after schema migrations.

  This prevents `sesame status` from failing on existing databases with `no such column: parent_session_id`.

## 0.6.0

### Minor Changes

- 5e1475e: Add support for session forks and custom_message entries

  - Parse and index `custom_message` entries (extension-injected LLM context)
  - Track session fork relationships via `parent_session_id`
  - Track entry tree structure via `entry_id`, `parent_entry_id`, `timestamp`, `source_type` on chunks
  - Add database migration for new columns

## 0.5.2

### Patch Changes

- f64dd16: Add `Last sync` to `sesame status` using durable metadata and update it only after successful indexing runs with actual changes.

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
  - Pi skill file
  - JSON and human-readable output formats
