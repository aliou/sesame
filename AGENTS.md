# AGENTS.md

- Stack: Node.js (>=25) + TypeScript (ESM) + SQLite FTS5; pnpm workspace under Vite+; Biome v2 for lint/format; Vitest via Vite+ for tests.
- Existing rule files in repo: none of CLAUDE.md/.cursorrules/.windsurfrules/.clinerules/.goosehints/.github/copilot-instructions.md.

## Build / lint / test

- Install deps: `vp install`
- Main validation gate: `vp check && vp test && vp run build`
- Lint / format / type-aware checks: `vp check`
- Run all tests: `vp test`
- Run one repo script: `vp run <script>`
- Run one file: `vp test -- packages/sesame/utils/date.test.ts`
- Run one test: `vp test -- packages/sesame/utils/date.test.ts -t "Invalid input throws"`
- Build the CLI SEA binary: `vp run build:binary`
- Git hooks: `vp config` installs hooks; staged checks are configured in `vite.config.ts`.

## Architecture / codebase

This is a pnpm monorepo managed through Vite+. Packages live under `packages/`:

- `packages/sesame/`: `@aliou/sesame` — the publishable library. Parses pi JSONL, indexes into SQLite FTS5, exposes BM25 search.
  - `packages/sesame/index.ts`: library entry point.
  - `packages/sesame/parsers/pi.ts` + `packages/sesame/types/session.ts`: parse pi JSONL into normalized turns/tool calls.
  - `packages/sesame/indexer/index.ts` + `packages/sesame/indexer/format-tool-call.ts`: scan sources, mtime-incremental index, create `message` + `tool_call` chunks.
  - `packages/sesame/storage/db.ts`: schema (`sessions`, `chunks`, `chunks_fts`), BM25 search, filters (`cwd`, date, tool, path, limit).
- `packages/cli/`: `@aliou/sesame-cli` — the CLI (private, not published to npm). Depends on `@aliou/sesame`.
  - `packages/cli/sesame.ts`: CLI entrypoint, lazy-dispatches `index|search|status|watch`.
  - `packages/cli/commands/*-cmd.ts`: CLI arg parsing + user output.
  - `packages/cli/vite.config.ts`: Vite+ config, including inline `pack` settings for building the Node SEA binary.
- `packages/pi/`: `@aliou/sesame-pi` — pi coding agent extension exposing the `sesame_search` tool (calls `sesame search --json`). Private, not published to npm.
- `packages/skills/sesame-cli/`: `@aliou/sesame-skill-cli` — pi skill for the Sesame CLI (search, index, status, watch usage). Private, not published to npm.

## Docs map

- `README.md`: project overview + quickstart.
- `docs/cli-usage.md`: CLI commands/flags/examples.
- `docs/indexing.md`: parser/indexer/chunking/schema behavior.
- `docs/library-usage.md`: exported API and programmatic usage.
- `docs/README.md`: docs index + Vite+ workflow notes.

## Style / conventions

- Imports: ESM, use `node:` built-ins, `import type` for types, imports at top (`no-inline-imports`), keep intentional dynamic import in `packages/cli/sesame.ts`.
- Formatting: Biome defaults (2 spaces, double quotes, organized imports).
- Types/naming/errors: strict TS, avoid `any` outside tests, camelCase vars/functions + PascalCase types/classes + kebab-case files (`*-cmd.ts`); throw in libs, catch/print/exit at CLI boundary, continue logging per-file/per-line parse/index failures.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev`, `vp build`, and `vp pack`.

## Vite+ Workflow

`vp` is the default entrypoint for install, checks, tests, builds, and pack tasks in this repository. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run package scripts or monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build apps through Vite
- pack - Build libraries and SEA-style package outputs
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. Use `vp check` and `vp test` as the default validation flow. Use `vp run <script>` when you need an existing `package.json` script such as `build`, `dev`, or `build:binary`.

## CI notes

- Prefer `voidzero-dev/setup-vp@v1` in GitHub Actions instead of separate Node, pnpm, and cache steps.
- Use `cache: true` when possible so dependency caching is handled by `setup-vp`.
- In this repo, CI should usually run `vp install`, `vp check`, `vp test`, and `vp run build`.
- For the CLI binary job, use `vp run build:binary` because the repo's binary build is still script-backed.

## Troubleshooting notes

- `vp build` does not run the repository `build` script. Use `vp run build` for the current monorepo TypeScript build script.
- `vp test` is the built-in Vitest command. Use `vp run test` only if you explicitly need the root `package.json` script.
- `vp staged` and git hooks depend on the `staged` block in `vite.config.ts`; rerun `vp config` if hooks are missing.
- If `vp check` skips type-aware linting or type checks, inspect `lint.options` in `vite.config.ts` and watch for `compilerOptions.baseUrl` in tsconfig files.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
- [ ] Use `vp run <script>` instead of calling pnpm directly when invoking repo scripts.
<!--VITE PLUS END-->
