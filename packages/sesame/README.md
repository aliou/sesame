# @aliou/sesame

Local BM25 search over coding-agent sessions. Parses Pi JSONL session files, indexes them into SQLite FTS5, and ranks results with BM25. Uses Node's built-in `node:sqlite`; no native dependencies.

This is the library behind the [`sesame` CLI](https://github.com/aliou/sesame).

## Install

```bash
npm install @aliou/sesame
```

Requires Node.js 26 or newer.

## Usage

Index sessions, then search them:

```ts
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { getXDGPaths, indexSessions, openDatabase } from "@aliou/sesame";

const dataDir = getXDGPaths().data;
await mkdir(dataDir, { recursive: true });
const db = openDatabase(join(dataDir, "index.sqlite"));
try {
  const result = await indexSessions(db, join(homedir(), ".pi/agent/sessions"));
  console.log(result); // { added, updated, skipped, errors }
} finally {
  db.close();
}
```

For interactive applications, search through the worker-backed API so SQLite queries stay off the event loop:

```ts
import { AsyncSessionSearch } from "@aliou/sesame";

const sessions = new AsyncSessionSearch();
try {
  const results = await sessions.search("release workflow", { limit: 5 });
  console.log(results);
} finally {
  await sessions.close();
}
```

The full export list, filters, and options are in [docs/library-usage.md](https://github.com/aliou/sesame/blob/main/docs/library-usage.md).
