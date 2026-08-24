---
"@aliou/sesame": patch
---

Fix indexing on databases migrated from 0.11.

Migration 5 kept the legacy `session_skills.source` column, which on migrated indexes is `TEXT NOT NULL` with no default — every session using a skill then failed to index with `NOT NULL constraint failed: session_skills.source`. Migration 8 drops the column (guarded, no-op where it is already absent). Includes a regression test that inserts a skilled session into a pre-migration database.
