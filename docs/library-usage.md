# Library usage

Sesame exports parser, indexer, storage, config, and date helpers from `src/index.ts`.

## Install (as dependency)

```bash
pnpm add @aliou/sesame
```

## Main exports

From `@aliou/sesame`:

- DB: `openDatabase`, `search`, `insertSession`, `deleteSession`, `dropAll`, `getStats`, `getSessionMtime`
- Parser/indexer: `PiParser`, `indexSessions`
- Config: `loadConfig`, `expandPath`, `getXDGPaths`
- Helpers/types: `parseRelativeDate` and core TS types


## Minimal example

```ts
import { join } from "node:path";
import { indexSessions, openDatabase, PiParser, search } from "@aliou/sesame";
import { getXDGPaths } from "@aliou/sesame";

const paths = getXDGPaths();
const db = openDatabase(join(paths.data, "index.sqlite"));

try {
  const parser = new PiParser();
  await indexSessions(db, "/Users/me/.pi/agent/sessions", parser);

  const results = search(db, "release workflow", {
    limit: 5,
    cwd: "/Users/me/code",
  });

  console.log(results);
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
- `status` (`"success" | "error"`)

Note: CLI currently does not expose every storage option (example: `status`).

## Runtime notes

`openDatabase()` chooses backend by runtime:

- Bun: `bun:sqlite`
- Node: `node:sqlite`

No external SQLite package needed.

## Errors and boundaries

Recommended pattern:

- throw/propagate errors in library usage
- catch and format only at process boundary (CLI/HTTP/etc.)
