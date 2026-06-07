# @aliou/sesame-cli

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
