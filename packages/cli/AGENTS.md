# AGENTS.md — @aliou/sesame-cli

Private CLI package. Not published to npm. Depends on `@aliou/sesame`.

## Package role

- Provides the `sesame` binary (search, skills, index, status, watch, completion).
- Builds a Node.js Single Executable Application (SEA) via tsdown for distribution.
- Follows https://clig.dev/ and the sbxctl CLI conventions (homelab/sandbox `packages/cli`).

## Key files

- `sesame.ts`: entrypoint. Calls `runCli(process.argv)` and sets the exit code.
- `run.ts`: `runCli(argv)`, the in-process pipeline tests drive.
- `argv.ts`: argv rewrites before Brocli: hoist the command ahead of leading global flags, fold repeated `--exclude`/`--arg` into one JSON value.
- `context.ts`: global flags, paths, config/database/lock helpers that map failures to error codes, `--debug` output.
- `help.ts`, `help-topics.ts`: global help and `sesame help <topic>`.
- `completion.ts`: `@bomb.sh/tab` completion tree. Keep it in sync with the Brocli commands (`completion-parity.test.ts` checks).
- `commands/index.ts`: command registry. `commands/*-cmd.ts`: one Brocli command each.
- `commands/watch-queue.ts`: serializes overlapping watch-triggered reindex runs.
- `kit/`: copy of `@378labs/sbx-cli-kit` 4.3.0 (run loop, output modes, errors). Local edits are marked "Sesame change".
- `testing/cli.ts`: output capture and a temp data/config sandbox for in-process tests.
- `tsdown.config.ts`: bundles `sesame.ts` into `dist/sesame.cjs` (the `bin`). With `SESAME_EXE=1`, builds SEA binaries into `dist-sea/`. Everything is bundled (`deps.alwaysBundle`).
- `scripts/smoke-build.mjs`: checks the built bundle (shebang, executable, `--version`, `--help`, `completion bash`, unknown command exits 2).
- `scripts/write-completions.mjs`: regenerates `<repo>/completions/` from the built bundle.

## Build

- `pnpm run build`: tsdown bundle to `dist/sesame.cjs`, then the smoke check.
- `pnpm run dev`: `tsdown --watch`. Run the CLI with `./dist/sesame.cjs`.
- `pnpm run build:binary`: SEA binaries in `dist-sea/sesame-<platform>-<arch>`.
- `pnpm run completions`: rewrite `<repo>/completions/` after a build. `completion-parity.test.ts` fails when they drift.
- `pnpm run typecheck`: `tsc --noEmit`.
- `pnpm test`: vitest (unit + in-process CLI tests).
- `pnpm run test:cli`: builds the SEA binary and runs it (`test/`).

## Conventions

- stdout is data only. Errors, warnings, hints, progress, and debug go to stderr.
- Every command supports `-o human|json`. Use `isJson()`, `writeJson()`, `writeHuman()`, `writeProgress()`, `writeStderr()` from `kit/output`.
- Throw `usageError(message, code)` for bad input (exit 2) and `CliError(message, code)` for runtime failures (exit 1). Never call `process.exit` in commands; `watch` signal shutdown is the only exception.
- Use `setCommandExitCode(3)` for "finished but degraded" results.
- `patches/` holds pnpm patches: Brocli (a command boolean flag must not swallow a following global flag) and `@bomb.sh/tab` (zsh must escape `:` in completion values).
- In-process CLI tests share module-level global option state; keep them sequential within a file.
