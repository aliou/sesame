---
"@aliou/sesame": minor
"@aliou/sesame-cli": minor
---

Fix high CPU in `sesame watch` caused by repeated full-directory re-indexing and redundant file I/O:

- Add `readFirstLine` utility that reads only the first 4 KiB of a file instead of loading the entire contents into memory.
- Fix `PiParser.canParse()` to use `readFirstLine` instead of reading the whole file just to check the header.
- Fix indexer mtime-skip path to use `readFirstLine` instead of `readFileSync` of the entire file.
- Add `indexFile(db, filePath)` for targeted single-file re-indexing without scanning the whole directory.
- Watch handler now does per-file debounce and targeted indexing for `.jsonl` changes, falling back to full scan only when no filename is available.
- Queue adds `SourceConfig.files` for targeted paths, `mergeSource()` to coalesce pending work, and a 2 s cooldown between consecutive indexing runs to prevent back-to-back re-indexes when Pi keeps appending to the active session.
