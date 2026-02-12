---
"@aliou/sesame": minor
---

Support `*` query to list all sessions with filters. When searching with `*`, returns all sessions ordered by modification date (newest first), respecting cwd/after/before/limit filters. Default limit of 10 ensures context safety.
