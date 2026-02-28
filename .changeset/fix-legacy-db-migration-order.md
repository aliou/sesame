---
"@aliou/sesame": patch
---

Fix legacy SQLite migration order so tree indexes are created after schema migrations.

This prevents `sesame status` from failing on existing databases with `no such column: parent_session_id`.
