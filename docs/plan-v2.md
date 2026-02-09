# Sesame - Search for Coding Agent Sessions

## Problem

Pi's `find_sessions` uses ripgrep with `--fixed-strings` for exact keyword matching across JSONL session files. This fails when users search for concepts rather than exact strings.

Real example: 9 out of 10 queries returned 0 results. Queries like "nix infrastructure simplify", "restructure repos packages", "carousel company website" found nothing because those exact phrases don't appear verbatim in any session file. Only single-word proper nouns ("Fizen", "bird", "grit") reliably return results.

## Real Query Patterns

Analysis of ~60 real `find_sessions` tool calls shows four categories:

**1. Concept/topic search (most common, most broken)**
```
"nix infrastructure simplify"
"restructure repos packages"
"carousel company website"
"custom components return value RPC"
"CI pipeline publish release workflow"
```
Multi-word queries describing what a session was about. These never appear as exact phrases in session text.

**2. Keyword/name search (works today)**
```
"bird", "Fizen", "grit", "Theo", "Nextlead"
```
Single words or proper nouns. Exact match handles these fine.

**3. Code/config pattern search**
```
".js extension exports package.json"
"tsup exports dist"
"require import inline middle of file"
```
Looking for tool call content -- file writes, edits, bash commands.

**4. Narrowing retries (symptom of bad search)**
```
"carousel company website" -> "carousel" -> "company website"
```
The agent retries with narrower/broader terms because search keeps returning nothing. Better search eliminates most retries.

## Solution: BM25 via SQLite FTS5

BM25 (Best Matching 25) is a ranking function built into SQLite's FTS5 extension. It solves categories 1-3 without any external dependencies:

- **Word independence**: "nix infrastructure simplify" matches documents containing any/all of those words, not requiring the exact phrase.
- **Stemming** (porter): "simplify" matches "simplified", "simplifying", "simplification".
- **TF-IDF ranking**: rare words ("attic") get higher weight than common words ("the").
- **Zero external dependencies**: FTS5 is built into SQLite, which is built into Bun.

BM25 does not handle synonyms ("carousel" won't match "slider"). This is a real gap but a small minority of real queries. Embedding-based search can be layered on later if needed.

## What is Sesame

A standalone CLI for full-text search over coding agent sessions. Not coupled to pi. Supports pluggable session parsers for different agent formats. Usable as a CLI, as a library, and as a pi extension tool.

### Design Principles

1. **Standalone first.** Works as a CLI outside of any agent. No pi dependency.
2. **Pluggable parsers.** Session format is abstracted behind a parser interface. Ships with a pi parser; others can be added.
3. **Local only.** No API keys, no cloud services. Everything runs on-device.
4. **Zero native dependencies.** Only `bun:sqlite` (built-in). No native addons, no model downloads.
5. **Incremental indexing.** Only re-index sessions that changed (tracked via mtime).

### Runtime and Distribution

- **Runtime:** Bun (required on host)
- **Install:** `bun install -g @aliou/sesame`
- **Entry point:** Bash wrapper script that locates Bun and runs `src/sesame.ts`

### Directory Layout (XDG)

```
~/.local/share/sesame/
  index.sqlite              # Database (FTS + metadata)

~/.config/sesame/
  config.jsonc              # Session sources
```

All paths follow XDG and are overridable via `SESAME_DATA_DIR` and `SESAME_CONFIG_DIR`.

### Configuration

```jsonc
{
  // Session sources to index
  "sources": [
    {
      "parser": "pi",
      "path": "~/.pi/agent/sessions"
    }
  ]
}
```

## Architecture

```
sesame CLI
  |
  +-- parsers (pi JSONL -> structured sessions)
  |
  +-- indexer (scan, parse, chunk, store)
  |
  +-- storage (bun:sqlite + FTS5)
  |
  +-- search (BM25 via FTS5, filters)
```

## Session Parsing

### Parser Interface

```typescript
interface SessionParser {
  id: string;
  canParse(path: string): Promise<boolean>;
  parse(path: string): Promise<ParsedSession>;
}

interface ParsedSession {
  id: string;
  source: string;           // parser id
  cwd?: string;
  name?: string;
  createdAt: string;
  modifiedAt: string;
  turns: Turn[];
}

interface Turn {
  role: "user" | "assistant" | "system";
  textContent: string;
  toolCalls: ToolCall[];
}

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}
```

### Pi Parser

Parses JSONL session files from `~/.pi/agent/sessions/`. Extracts:
- Session header (id, cwd, timestamp)
- Session info (name)
- User messages (text content)
- Assistant messages (text content + tool calls)
- Tool call results
- Compaction summaries

## Storage Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  path TEXT NOT NULL,
  cwd TEXT,
  name TEXT,
  created_at TEXT,
  modified_at TEXT,
  message_count INTEGER,
  file_mtime INTEGER
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- 'message' or 'tool_call'
  role TEXT,                      -- 'user', 'assistant', 'system' (for messages)
  tool_name TEXT,                 -- tool name (for tool_calls)
  seq INTEGER,                   -- position in session
  content TEXT NOT NULL
);

CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync with chunks table
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
END;
CREATE TRIGGER chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE INDEX idx_chunks_session ON chunks(session_id);
CREATE INDEX idx_chunks_kind ON chunks(kind);
CREATE INDEX idx_chunks_tool ON chunks(tool_name);
```

## Chunking Strategy

### Messages (kind = 'message')

Each user/assistant/system message becomes one chunk. No splitting, no overlap, no token counting. A message is the natural search unit. Title/rename events in session files are ignored.

Why: queries are short (2-5 words). BM25 works best when document units are small enough that word frequency is meaningful. Individual messages are the right granularity.

### Tool calls (kind = 'tool_call')

Each tool call becomes one chunk. The content is a structured text representation:

```
tool: write
path: src/utils/config.ts
content:
export function loadConfig() { ... }
```

```
tool: bash
command: npm test
output:
PASS src/utils/config.test.ts
```

```
tool: edit
path: src/utils/config.ts
old: const x = 1
new: const x = 2
```

This makes tool call content searchable via BM25. A query like ".js extension exports" matches tool calls that wrote to package.json exports fields.

## Search

### Query Pipeline

```
Query: "nix infrastructure simplify"
  |
  +-- FTS5 MATCH with bm25() ranking
  |
  +-- JOIN with sessions for metadata + filters
  |
  +-- GROUP BY session (best chunk score per session)
  |
  +-- ORDER BY score, LIMIT N
  |
  v
Results: ranked sessions with matching snippet
```

### Filters

- `--cwd /path` -- filter by project directory
- `--after 7d` / `--before 2026-01-01` -- date filters
- `--limit N` -- result count (default 10)
- `--tools` -- search only tool call chunks
- `--tool write` / `--tool bash` -- search specific tool types
- `--json` -- JSON output for tool integration

### Output

**Human-readable (default):**
```
Found 5 sessions matching "nix infrastructure simplify"

  [0.82] abc12345 (Simplify Nix flake setup) - 2025-12-15
         "Let's restructure the nix flakes to reduce duplication..."

  [0.71] def67890 (Nix cache refactor) - 2025-12-10
         "I want to set up attic for binary caching..."
```

**JSON (`--json`):**
```json
{
  "query": "nix infrastructure simplify",
  "resultCount": 5,
  "results": [
    {
      "sessionId": "abc12345",
      "source": "pi",
      "path": "/path/to/session.jsonl",
      "cwd": "/Users/aliou/code/infra",
      "name": "Simplify Nix flake setup",
      "score": 0.82,
      "created": "2025-12-15T10:00:00Z",
      "matchedSnippet": "Let's restructure the nix flakes to reduce duplication..."
    }
  ]
}
```

## CLI

```
sesame index                     # Incremental index
sesame index --full              # Drop and rebuild
sesame search "query"            # BM25 search across messages and tool calls
sesame search "query" --tools    # Search only tool calls
sesame search "query" --tool bash  # Search only bash tool calls
sesame search "query" --cwd /x   # Filter by project directory
sesame search "query" --after 7d # Date filter
sesame search "query" --json     # JSON output
sesame status                    # Index stats
```

## Pi Integration

Two integration pieces:

1. **Pi extension**: Provides sesame search as a tool. Calls `sesame search --json` as a subprocess and returns results. Does not replace `find_sessions` -- it is a separate, better search tool.

2. **Skill file**: Teaches the agent how to use the sesame CLI directly, for environments where the extension is not available. Covers `sesame search`, `sesame index`, and when to use sesame vs `find_sessions`.

## Implementation Phases

### Phase 1: BM25 Search on Messages

The minimum useful product. Replaces ripgrep-based search with BM25 for message text.

1. **Project setup**: Bun project, bun:sqlite, XDG paths, JSONC config.
2. **Pi parser**: Parse JSONL session files into structured sessions.
3. **Indexer**: Scan directories, parse files, store session metadata and message chunks. Incremental via mtime.
4. **Search**: BM25 via FTS5, grouped by session, with filters (cwd, date, limit).
5. **CLI**: `index`, `search`, `status` commands.
6. **Pi integration**: Extension + skill file.

### Phase 2: Tool Call Search

Index tool calls so we can search for code patterns, file paths, bash commands.

1. **Tool call chunking**: Extract tool calls, format as structured text, store with kind='tool_call'.
2. **Tool-specific search**: `--tools`, `--tool write`, `--tool bash` flags.
3. **Path search**: `--path "config.ts"` to find sessions that touched a file.

### Phase 3 (Future): Semantic Search

If BM25 proves insufficient for synonym/concept matching, layer embedding-based vector search on top. Hybrid BM25 + vector with RRF fusion. Only pursued if real usage shows gaps that matter.

## Resolved Decisions

1. **Pi integration**: Subprocess with `--json`. Extension calls `sesame search --json`. A separate skill covers CLI usage for environments without the extension.
2. **Default search scope**: Both messages and tool calls, with message matches ranked higher.
3. **Session-level summary chunks**: No. Message-level chunks only.
