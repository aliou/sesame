---
"@aliou/sesame": patch
"@aliou/sesame-cli": patch
---

Handle current pi session files. Edit tool calls now index the old and new text of every entry in pi's `edits[]` array; before, only the path was indexed. The `powershell` tool is formatted like `bash` and accepts `--arg powershell:command=...`. `usage` and `context_edit` entries are skipped without "Unknown line type" warnings, and `system` role messages (system prompt snapshots) are skipped explicitly. Messages with `null` content and `session_info` entries without a name no longer drop the line. Re-index with `sesame index --full` to backfill edit text for existing sessions.
