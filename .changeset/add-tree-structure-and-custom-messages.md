---
"@aliou/sesame": minor
---

Add support for session forks and custom_message entries

- Parse and index `custom_message` entries (extension-injected LLM context)
- Track session fork relationships via `parent_session_id`
- Track entry tree structure via `entry_id`, `parent_entry_id`, `timestamp`, `source_type` on chunks
- Add database migration for new columns
