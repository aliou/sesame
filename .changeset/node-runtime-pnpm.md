---
"@aliou/sesame": minor
---

Migrate runtime from Bun APIs to Node.js APIs and switch project workflows to pnpm while keeping Bun only for binary builds.

Key updates:
- use `node:sqlite` instead of `bun:sqlite`
- replace Bun file APIs with Node fs APIs
- run tests with Vitest
- use pnpm lockfile/workflows in CI and release pipelines
- keep `build:binary` on Bun for compiled binaries
