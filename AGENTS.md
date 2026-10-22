# AGENTS.md

pnpm monorepo for Sesame, BM25 search over Pi session files. `packages/sesame/` is the published library (`@aliou/sesame`); `packages/cli/` is the private `sesame` CLI. Each package has its own `AGENTS.md`. Docs are indexed in `docs/README.md`; `docs/indexing.md` covers parser, chunking, and schema behavior.

## Checks

- The Husky pre-push hook runs `check:lockfile`, `lint`, and `build`. Run them before pushing.
- `completions/` is committed and installed by `flake.nix`. After a CLI command or flag change, build and run `pnpm --filter @aliou/sesame-cli run completions`; `completion-parity.test.ts` fails when they drift.
- `skills/sesame/SKILL.md` documents CLI usage for agents; update it with user-facing CLI changes.

## Conventions

- Imports use `node:` built-ins, `import type` for types, and stay at the top of the file (Biome `no-inline-imports`).
- Files are kebab-case; CLI commands are `commands/*-cmd.ts`. Avoid `any` outside tests.
- Libraries throw. Only the CLI boundary catches, prints, and sets the exit code. Indexing logs per-file and per-line parse failures and continues.
