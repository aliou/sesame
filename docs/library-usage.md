# Library usage

Sesame exports parser, indexer, storage, config, locking, date, and XDG helpers from `packages/sesame/index.ts`.

Search ranking uses SQLite FTS5 BM25 through Node's built-in `node:sqlite` module.

## Install

```bash
pnpm add @aliou/sesame
```

Runtime requirement: Node.js 26 or newer.

## Main exports

From `@aliou/sesame`:

- Database/storage: `openDatabase`, `search`, `insertSession`, `deleteSession`, `dropAll`, `getSession`, `getSessionMtime`, `getStats`, `listSessions`, `setMetadata`
- Skills: `getSessionSkills`, `getSkillsForSessions`, `listIndexedSkills`, `detectSkills`, `skillNameFromPath`
- Indexer/parser: `indexSessions`, `PiParser`
- Config/helpers: `loadConfig`, `expandPath`, `getXDGPaths`, `parseRelativeDate`, `acquireIndexLock`
- Types: `Database`, `SearchOptions`, `SearchResult`, `ListSessionsOptions`, `ListSkillsOptions`, `SkillSummary`, `SkillUsage`, `SkillUsageSource`, `StoredSession`, `StoredChunk`, `StoredSkill`, `ParsedSession`, `ToolCall`, `Turn`, `IndexResult`, `IndexLockHandle`, `SesameConfig`

`getMetadata` exists internally but is not exported from the package entry point.

## Minimal search example

```ts
import { join } from "node:path";
import { getXDGPaths, openDatabase, search } from "@aliou/sesame";

const paths = getXDGPaths();
const db = openDatabase(join(paths.data, "index.sqlite"));

try {
  const results = search(db, "release workflow", {
    limit: 5,
    cwd: "/Users/me/code",
  });

  console.log(results);
} finally {
  db.close();
}
```

## Indexing example

```ts
import { join } from "node:path";
import { getXDGPaths, indexSessions, openDatabase } from "@aliou/sesame";

const paths = getXDGPaths();
const db = openDatabase(join(paths.data, "index.sqlite"));

try {
  const result = await indexSessions(db, "/Users/me/.pi/agent/sessions");
  console.log(result);
} finally {
  db.close();
}
```

`indexSessions()` returns:

```ts
interface IndexResult {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}
```

## Search API

```ts
const results = search(db, "package exports", {
  cwd: "/Users/me/code/project",
  after: "2026-05-01",
  before: "2026-05-08",
  limit: 10,
  toolsOnly: true,
  toolName: "write",
  pathFilter: "package.json",
  skill: "vitest",
  skillPath: "/skill-library/",
  exclude: ["session-id-to-skip"],
  status: "success",
});
```

`SearchOptions` supports:

- `cwd`: session cwd prefix
- `after`, `before`: ISO date strings compared against `sessions.modified_at`
- `limit`: max sessions returned; default 10
- `toolsOnly`: restrict matches to `tool_call` chunks
- `toolName`: restrict matches to one tool name
- `pathFilter`: restrict matches to tool-call chunks whose formatted content contains the string
- `skill`: only sessions that used this skill, matched on the exact skill directory name, case-insensitive
- `skillPath`: only sessions that used a skill whose `SKILL.md` path contains this literal substring; set with `skill` to require both on the same skill
- `exclude`: session ids to omit
- `status`: `"success" | "error"`; applies only when `toolsOnly` or `toolName` is set
- `json`: carried for CLI option plumbing; storage results are always JavaScript objects

`search(db, "*", options)` lists sessions by `modified_at DESC` instead of using FTS. The query is optional; omitted, empty, and whitespace-only queries are normalized to `"*"`. Multi-term FTS searches first match all terms, then retry with any term only when filters leave no all-term results.

`SearchResult` contains:

```ts
interface SearchResult {
  sessionId: string;
  source: string;
  path: string;
  cwd: string | null;
  name: string | null;
  score: number;
  createdAt: string | null;
  modifiedAt: string | null;
  matchedSnippet: string;
  matchMode: "all" | "any" | "browse";
  matchedType: string | null;
  matchedEntryId: string | null;
  matchedAt: string | null;
}
```

For FTS searches, lower raw BM25 scores are better. `matchedType`, `matchedEntryId`, and `matchedAt` identify the best-scoring chunk. Browse results use `matchMode: "browse"` and null provenance. For browse searches, `score` is `0` and `matchedSnippet` is the session name or `"(recent session)"`.

## Listing sessions

Use `listSessions()` when you need session metadata without FTS:

```ts
const sessions = listSessions(db, {
  cwd: "/Users/me/code",
  after: "2026-05-01",
  skill: "vitest",
  limit: 50,
  offset: 0,
});
```

`limit` is clamped to `1..500`; `offset` is clamped to `>= 0`. `skill` and `skillPath` behave the same as in `SearchOptions`.

## Skills

Sesame records which skills a session used, either because the `skill-autocomplete` hook injected a `<skill>` block (`source: "invocation"`) or because the agent read a `SKILL.md` file with a read tool (`source: "read"`).

```ts
import {
  getSessionSkills,
  getSkillsForSessions,
  listIndexedSkills,
  search,
} from "@aliou/sesame";

// Sessions that used a skill
const results = search(db, "*", { skill: "vitest", after: "2026-05-01" });

// Skills used by one session
const skills = getSessionSkills(db, results[0].sessionId);

// Skills for many sessions at once, keyed by session id
const bySession = getSkillsForSessions(
  db,
  results.map((r) => r.sessionId),
);

// Skill leaderboard across the index
const summary = listIndexedSkills(db, { source: "invocation", limit: 20 });
```

`StoredSkill` is `{ session_id, name, path, source }` with `path` nullable. `listIndexedSkills()` returns `{ name, sessionCount, sources, paths }` grouped by skill name, ordered by `sessionCount DESC, name ASC`; its `limit` is clamped to `1..1000`.

To derive skill usage without the database, call `detectSkills(parsedSession.turns)`, or read `ParsedSession.skills` directly from `PiParser.parse()`.

Upgrading an existing index adds the `session_skills` table and invalidates stored mtimes, so a plain `sesame index` backfills skills on the next run.

Run `sesame index --full` after upgrading to populate searchable titles/checkpoints and remove existing discovery-result bodies from the index.

## Config and paths

`loadConfig()` reads `<config-dir>/config.jsonc`. If missing, it creates the default config:

```json
{
  "piSessionPaths": ["~/.pi/agent/sessions"]
}
```

`getXDGPaths()` returns Sesame's data, config, cache, and runtime directories. It respects these overrides:

- `SESAME_DATA_DIR`, `SESAME_CONFIG_DIR`, `SESAME_CACHE_DIR`, `SESAME_RUNTIME_DIR`
- `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_RUNTIME_DIR`

`expandPath()` expands only `~/...` paths.

## Runtime notes

- `openDatabase()` uses `node:sqlite` and enables WAL mode plus foreign keys.
- No external SQLite package is needed.
- Call `db.close()` when done.
- Use `acquireIndexLock()` around long-running index writes if your application can run concurrent indexers.

## Errors and boundaries

Recommended pattern:

- throw or propagate errors inside library usage
- catch and format only at process boundaries such as CLI commands, HTTP handlers, or background workers
