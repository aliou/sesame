---
"@aliou/sesame": patch
---

Fix SQLite runtime compatibility by selecting `node:sqlite` on Node and `bun:sqlite` on Bun, so Bun-compiled binaries no longer crash on startup. Also add a CLI integration test that builds and runs the Bun binary, plus test config isolation so Vitest only runs Node unit tests while Bun runs CLI binary tests.
