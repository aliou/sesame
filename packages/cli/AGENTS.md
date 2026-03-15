# AGENTS.md — @aliou/sesame-cli

Private CLI package. Not published to npm. Depends on `@aliou/sesame`.

## Package role

- Provides the `sesame` binary (index, search, status, watch).
- Builds a Node.js Single Executable Application (SEA) via tsdown for distribution.

## Key files

- `sesame.ts`: entrypoint — lazy-dispatches to command handlers.
- `commands/index-cmd.ts`: `sesame index [--full]`.
- `commands/search-cmd.ts`: `sesame search <query> [options]`.
- `commands/status-cmd.ts`: `sesame status`.
- `commands/watch-cmd.ts`: `sesame watch [--interval]`.
- `commands/watch-queue.ts`: serializes overlapping watch-triggered reindex runs.
- `bin/sesame`: thin shell wrapper for local dev (runs `sesame.ts` via node).
- `tsdown.config.ts`: tsdown config for building the SEA binary.
- `build.ts`: script that invokes tsdown to produce the platform binary.

## Build

- `pnpm run build`: `tsc` — emits to `dist/` (used for local dev via `bin/sesame`).
- `pnpm run build:binary`: builds the Node SEA binary via tsdown into `dist/sesame`.
- `pnpm run typecheck`: `tsc --noEmit`.
- `pnpm test`: vitest (unit tests).
- `pnpm run test:cli`: vitest with `vitest.cli.config.ts` (integration tests in `test/`).

## Conventions

- Catch and format all errors at the CLI boundary; never throw to the top level.
- Each command module exports one `run(args)` function.
- Use `process.exit(1)` only in command handlers, not in library code.
- Keep the dynamic `import()` in `sesame.ts` intentional — it enables lazy loading and is whitelisted by the no-inline-imports lint rule.
