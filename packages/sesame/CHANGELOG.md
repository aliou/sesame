# @aliou/sesame

## 0.12.0

### Minor Changes

- 5353588: Add skill-based filtering.

  Sesame now records which skills each session used, from two signals: `skill-invocation` custom messages injected by the `skill-autocomplete` hook, and read tool calls that load a `SKILL.md` file. Usage is stored in a new `session_skills` table.

  - `sesame search --skill <name>` filters by exact skill name (case-insensitive)
  - `sesame search --skill-path <substring>` filters by `SKILL.md` path; combined with `--skill` both must match the same skill
  - `sesame skills` lists indexed skills with session counts, sources, and paths
  - Search output lists each result's skills
  - Library adds `SearchOptions.skill` / `skillPath`, the same two options on `ListSessionsOptions`, plus `getSessionSkills`, `getSkillsForSessions`, `listIndexedSkills`, `detectSkills`, `skillNameFromPath`, and `ParsedSession.skills`

  Migration 4 resets stored mtimes, so the next `sesame index` backfills skills for existing indexes.

  `insertSession` now replaces an existing session inside its transaction, so an interrupted re-index can no longer leave a session deleted without a replacement.

- ab12849: Search sessions by tool call parameters.

  Allowlisted tool call parameters are now extracted at index time into a new `tool_call_args` table (migration 7), powering parameter-level filters:

  - `SearchOptions` and `ListSessionsOptions` gain `toolArgs: ToolArgFilter[]` — each `{ tool, key, value }` filter is an `EXISTS` check (AND across filters, `value` matched as a substring)
  - Library exports `TOOL_ARG_ALLOWLIST`, `isAllowedToolArg`, `extractToolArgs`, and the `ToolArgFilter` type
  - CLI gains a repeatable `--arg tool:key=value` flag that validates against the allowlist (e.g. `sesame search --arg find:pattern=useStorage`)

  The allowlist covers pi's native tools (`bash`, `read`, `write`, `edit`, `find`, `grep`, `ls`) plus custom harness tools (`find_sessions`, `list_sessions`, `read_session`, `read_url`, `synthetic_web_search`, `process`). Migration 7 invalidates stored mtimes so the next index backfills existing sessions.

- b5e0c78: Record skill usage actor/detail and add fuzzy skill search.

  `session_skills.source` is replaced by `actor` (`user` | `agent`) plus `detail` (`slash` | `autocomplete` | null). A third detection shape recognizes `/skill:name` slash invocations, where pi inlines a `<skill name= location=>` block at the start of the user message. Migration 5 backfills `actor` from the legacy `source` column.

  A new global skill catalog (`skills` + `skills_fts`, migration 6) records skill description versions — one row per distinct (name, description, path), bumped on `last_seen_at` when re-encountered. Descriptions come from invocation hook details or SKILL.md frontmatter.

  - `SearchOptions` / `ListSessionsOptions` gain `skillQuery` (fuzzy over name + description; an unmatched query returns no sessions)
  - Library adds `matchSkills`, `upsertSkillCatalog`, `skillNameExists`, `parseSkillDescription`, and the `SkillMatch` type; `SkillSummary` replaces `sources` with `actors` + `details` and gains `description`
  - `ListSkillsOptions.source` becomes `actor`
  - CLI: `sesame search --skill <text>` falls back to fuzzy matching when the text is not an exact skill name; `sesame skills --source` becomes `--actor` and prints the latest known description

### Patch Changes

- 3c6c5dc: Fix indexing on databases migrated from 0.11.

  Migration 5 kept the legacy `session_skills.source` column, which on migrated indexes is `TEXT NOT NULL` with no default — every session using a skill then failed to index with `NOT NULL constraint failed: session_skills.source`. Migration 8 drops the column (guarded, no-op where it is already absent). Includes a regression test that inserts a skilled session into a pre-migration database.

## 0.11.1

### Patch Changes

- 219f7c2: Fix stale index lock when the recorded watch pid was reused by an unrelated
  process. `isProcessAlive` treated `EPERM` from `process.kill(pid, 0)` as
  "alive", so a dead watch whose pid got recycled by a system process (e.g.
  `mediaremoteagent`) left the lock permanently un-clearable and the launchd
  agent crash-looping with "Index already running". EPERM now means the pid
  is not ours and the stale lock is removed.

## 0.11.0

### Minor Changes

- 8dba5d1: Bump Node engine requirement to >=26.0.0 and migrate binary builds to
  @tsdown/exe cross-platform SEA (replaces per-platform CI matrix with a
  single build job; drops useCodeCache which is incompatible with
  cross-platform SEAs). Repos using the flake devShell now get Node 26.
- 36d583f: Add searchable current session titles and active checkpoints, automatic broad
  search fallback, match provenance, and optional-query session browsing. Date
  filters use session modification times. Rebuild existing indexes with `sesame
index --full` to apply the updated chunking rules.

## 0.10.0

### Minor Changes

- 84d611e: Fix high CPU in `sesame watch` caused by repeated full-directory re-indexing and redundant file I/O:

  - Add `readFirstLine` utility that reads only the first 4 KiB of a file instead of loading the entire contents into memory.
  - Fix `PiParser.canParse()` to use `readFirstLine` instead of reading the whole file just to check the header.
  - Fix indexer mtime-skip path to use `readFirstLine` instead of `readFileSync` of the entire file.
  - Add `indexFile(db, filePath)` for targeted single-file re-indexing without scanning the whole directory.
  - Watch handler now does per-file debounce and targeted indexing for `.jsonl` changes, falling back to full scan only when no filename is available.
  - Queue adds `SourceConfig.files` for targeted paths, `mergeSource()` to coalesce pending work, and a 2 s cooldown between consecutive indexing runs to prevent back-to-back re-indexes when Pi keeps appending to the active session.

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
