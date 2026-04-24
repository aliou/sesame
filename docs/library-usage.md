# Library usage

Sesame exports parser, indexer, storage, config, locking, and date helpers from `packages/sesame/index.ts`.

Search ranking uses SQLite FTS5 BM25.

## Install (as dependency)

```bash
pnpm add @aliou/sesame
```

## Main exports

From `@aliou/sesame`:

- DB: `openDatabase`, `search`, `insertSession`, `deleteSession`, `dropAll`, `getSession`, `getSessionMtime`, `getStats`, `listSessions`, `setMetadata`
- Indexer/parser: `indexSessions`, `PiParser`
- Config/helpers: `loadConfig`, `expandPath`, `getXDGPaths`, `parseRelativeDate`, `acquireIndexLock`
- Types: `Database`, `SearchOptions`, `SearchResult`, `ListSessionsOptions`, `StoredSession`, `StoredChunk`, `ParsedSession`, `ToolCall`, `Turn`, `IndexResult`, `IndexLockHandle`, `SesameConfig`

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

## Search options

`SearchOptions` supports:

- `cwd`, `after`, `before`, `limit`
- `toolsOnly`, `toolName`
- `pathFilter`
- `exclude`
- `status` (`"success" | "error"`), when combined with `toolsOnly` or `toolName`

`json` is present on `SearchOptions` for CLI output handling, but storage results are always returned as JavaScript objects.

## Runtime notes

`openDatabase()` uses `node:sqlite`.

No external SQLite package needed.

## Errors and boundaries

Recommended pattern:

- throw/propagate errors in library usage
- catch and format only at process boundary (CLI/HTTP/etc.)
