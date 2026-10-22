# AGENTS.md — @aliou/sesame

Published library: the source of truth for parsing, indexing, and searching Pi sessions.

- `index.ts` is the public API. Export everything through it; do not add deep imports. Update `docs/library-usage.md` and `README.md` when exports change.
- Storage migrations live in `storage/migrations/`, numbered (`001-`, `002-`, ...). Always add a new file; never edit an existing one.
- `files` in `package.json` controls the tarball; a root `.npmignore` cannot override it. Keep `test-helpers/` out of both the tarball and the public exports. Check with `pnpm pack --dry-run`.
- Throw errors; never call `process.exit()`.
