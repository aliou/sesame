# @aliou/sesame-cli

## 0.12.0

### Minor Changes

- 2b74960: CLI updates: fuzzy skills, tool-arg filters, and clig.dev conventions.

  - `sesame search --skill <text>` falls back to fuzzy matching over skill names and descriptions when the text is not an exact skill name
  - `sesame search --arg tool:key=value` filters by allowlisted tool call parameters (repeatable, validated loudly)
  - `sesame skills --source` becomes `--actor user|agent` and prints each skill's latest known description
  - New `--version`/`-V` (global and per-command), per-command `--help`/`-h`, loud errors for unknown options and missing flag values, and `--limit`/`--interval` validation as positive integers

  After upgrading, run `sesame index` once: migrations 5-7 invalidate stored mtimes, so this pass re-parses every session and backfills skill actors, the skill catalog, and tool arguments.

- 5353588: Add skill-based filtering.

  Sesame now records which skills each session used, from two signals: `skill-invocation` custom messages injected by the `skill-autocomplete` hook, and read tool calls that load a `SKILL.md` file. Usage is stored in a new `session_skills` table.

  - `sesame search --skill <name>` filters by exact skill name (case-insensitive)
  - `sesame search --skill-path <substring>` filters by `SKILL.md` path; combined with `--skill` both must match the same skill
  - `sesame skills` lists indexed skills with session counts, sources, and paths
  - Search output lists each result's skills
  - Library adds `SearchOptions.skill` / `skillPath`, the same two options on `ListSessionsOptions`, plus `getSessionSkills`, `getSkillsForSessions`, `listIndexedSkills`, `detectSkills`, `skillNameFromPath`, and `ParsedSession.skills`

  Migration 4 resets stored mtimes, so the next `sesame index` backfills skills for existing indexes.

  `insertSession` now replaces an existing session inside its transaction, so an interrupted re-index can no longer leave a session deleted without a replacement.

### Patch Changes

- Updated dependencies [3c6c5dc]
- Updated dependencies [5353588]
- Updated dependencies [ab12849]
- Updated dependencies [b5e0c78]
  - @aliou/sesame@0.12.0

## 0.11.1

### Patch Changes

- 219f7c2: Fix stale index lock when the recorded watch pid was reused by an unrelated
  process. `isProcessAlive` treated `EPERM` from `process.kill(pid, 0)` as
  "alive", so a dead watch whose pid got recycled by a system process (e.g.
  `mediaremoteagent`) left the lock permanently un-clearable and the launchd
  agent crash-looping with "Index already running". EPERM now means the pid
  is not ours and the stale lock is removed.
- Updated dependencies [219f7c2]
  - @aliou/sesame@0.11.1

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

### Patch Changes

- Updated dependencies [8dba5d1]
- Updated dependencies [36d583f]
  - @aliou/sesame@0.11.0

## 0.10.0

### Minor Changes

- 84d611e: Fix high CPU in `sesame watch` caused by repeated full-directory re-indexing and redundant file I/O:

  - Add `readFirstLine` utility that reads only the first 4 KiB of a file instead of loading the entire contents into memory.
  - Fix `PiParser.canParse()` to use `readFirstLine` instead of reading the whole file just to check the header.
  - Fix indexer mtime-skip path to use `readFirstLine` instead of `readFileSync` of the entire file.
  - Add `indexFile(db, filePath)` for targeted single-file re-indexing without scanning the whole directory.
  - Watch handler now does per-file debounce and targeted indexing for `.jsonl` changes, falling back to full scan only when no filename is available.
  - Queue adds `SourceConfig.files` for targeted paths, `mergeSource()` to coalesce pending work, and a 2 s cooldown between consecutive indexing runs to prevent back-to-back re-indexes when Pi keeps appending to the active session.

### Patch Changes

- 2b6e372: Expose the CLI through a flake package and keep release binary hashes updated.
- Updated dependencies [84d611e]
  - @aliou/sesame@0.10.0

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

### Patch Changes

- Updated dependencies [dc5e9aa]
  - @aliou/sesame@0.9.0
