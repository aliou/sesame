---
"@aliou/sesame": minor
"@aliou/sesame-cli": minor
---

Library changes:

- Add `listSessions` and `getSession` to the public library API.
- Keep the parser and indexing flow explicitly Pi-only after the workspace split.
- Refresh the Sesame skill and usage documentation.

CLI changes:

- Bundle `@aliou/sesame` into the standalone SEA binary.
- Replace lazy dynamic command imports with static imports in the CLI entrypoint.
- Refresh CLI help, metadata, and usage documentation.
- Split release automation so the library publishes to npm and the CLI creates its own GitHub release with binaries.

Repository changes:

- Split the project into `@aliou/sesame` and private `@aliou/sesame-cli` workspace packages.
- Upgrade Biome and lint plugins.
- Remove the unused Pi extension package.
