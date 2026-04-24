---
"@aliou/sesame": minor
---

Split the project into a pnpm workspace with separate library and CLI packages, removed the unused Pi extension, and made session config/indexing explicitly Pi-only. Added `listSessions` and `getSession` to the library API, expanded stored session metadata, and fixed the CLI binary build so it bundles `@aliou/sesame` correctly.
