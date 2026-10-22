# AGENTS.md — @aliou/sesame-cli

Private CLI package, not published to npm. Follows https://clig.dev/ and the sbxctl CLI conventions (homelab/sandbox `packages/cli`).

- `kit/` is a copy of `@378labs/sbx-cli-kit` 4.3.0. Mark local edits with a "Sesame change" comment so the kit can be re-synced.
- `completion.ts` must stay in sync with the Brocli commands; `completion-parity.test.ts` checks it.
- stdout is data only. Errors, warnings, hints, progress, and debug go to stderr.
- Every command supports `-o human|json`. Write output through `isJson()`, `writeJson()`, `writeHuman()`, `writeProgress()`, and `writeStderr()` from `kit/output`.
- Throw `usageError(message, code)` for bad input (exit 2) and `CliError(message, code)` for runtime failures (exit 1). Use `setCommandExitCode(3)` for "finished but degraded". Never call `process.exit` in commands; `watch` signal shutdown is the only exception.
- `patches/` at the repo root holds pnpm patches with known reasons: Brocli (a command boolean flag must not swallow a following global flag) and `@bomb.sh/tab` (zsh must escape `:` in completion values). Check them before upgrading either dependency.
- In-process CLI tests share module-level global option state; keep them sequential within a file.
- `pnpm run test:cli` builds the SEA binary and runs it; plain `pnpm test` does not.
