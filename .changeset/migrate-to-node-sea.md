---
"@aliou/sesame": minor
---

Migrate from Bun to Node 25 + tsdown SEA for binary builds.

- Replace `bun:sqlite` with `node:sqlite` as the sole SQLite backend.
- Replace `bun build --compile` with tsdown exe (Node SEA) for standalone binaries.
- Migrate CLI tests from `bun:test` to vitest.
- Bump minimum Node version to `>=25.0.0`.
- CI builds binaries for linux-x64, linux-arm64, and darwin-arm64 via matrix strategy.
