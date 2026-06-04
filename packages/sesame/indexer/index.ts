import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PiParser } from "../parsers/pi";
import {
  type Database,
  deleteSession,
  getSessionMtime,
  insertSession,
  type StoredChunk,
  type StoredSession,
} from "../storage/db";
import { readFirstLine } from "../utils/io";
import { formatToolCall } from "./format-tool-call";

export interface IndexResult {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Index a single file that has already passed `canParse`.
 *
 * Reads only the first line for the mtime skip check (efficient I/O), then
 * fully parses and upserts the session if needed.
 */
async function indexKnownFile(
  db: Database,
  filePath: string,
  parser: PiParser,
): Promise<IndexResult> {
  const result: IndexResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Get file mtime
    const stats = statSync(filePath);
    const fileMtime = Math.floor(stats.mtimeMs);

    // Quick mtime check: read just the session ID from first line
    const firstLine = readFirstLine(filePath);
    if (firstLine) {
      const header = JSON.parse(firstLine);
      const sessionId = header.id;
      if (sessionId) {
        const storedMtime = getSessionMtime(db, sessionId);
        if (storedMtime !== null && storedMtime === fileMtime) {
          result.skipped++;
          return result;
        }
      }
    }

    // Parse the full session
    console.error(`Indexing ${filePath}...`);
    const parsedSession = await parser.parse(filePath);

    // Check if session exists (may not have been caught above)
    const storedMtime = getSessionMtime(db, parsedSession.id);

    // Delete old data if exists
    if (storedMtime !== null) {
      deleteSession(db, parsedSession.id);
    }

    // Build stored session
    const storedSession: StoredSession = {
      id: parsedSession.id,
      source: parsedSession.source,
      path: filePath,
      cwd: parsedSession.cwd ?? null,
      name: parsedSession.name ?? null,
      created_at: parsedSession.createdAt ?? null,
      modified_at: parsedSession.modifiedAt ?? null,
      message_count: parsedSession.turns.length,
      file_mtime: fileMtime,
      parent_session_id: parsedSession.parentSessionId ?? null,
    };

    // Build chunks from turns: message chunks + tool call chunks
    const chunks: StoredChunk[] = [];
    let seq = 0;
    for (const turn of parsedSession.turns) {
      // Message chunk
      if (turn.textContent.trim()) {
        chunks.push({
          id: 0,
          session_id: parsedSession.id,
          kind: "message",
          role: turn.role,
          tool_name: turn.toolName ?? null,
          seq: seq++,
          content: turn.textContent,
          is_error: turn.isError !== undefined ? (turn.isError ? 1 : 0) : null,
          entry_id: turn.entryId ?? null,
          parent_entry_id: turn.parentEntryId ?? null,
          timestamp: turn.timestamp ?? null,
          source_type: turn.sourceType ?? null,
        });
      }

      // Tool call chunks
      for (const tc of turn.toolCalls) {
        const content = formatToolCall(tc);
        if (content.trim()) {
          chunks.push({
            id: 0,
            session_id: parsedSession.id,
            kind: "tool_call",
            role: null,
            tool_name: tc.name,
            seq: seq++,
            content,
            is_error: null,
            entry_id: turn.entryId ?? null,
            parent_entry_id: turn.parentEntryId ?? null,
            timestamp: turn.timestamp ?? null,
            source_type: turn.sourceType ?? null,
          });
        }
      }
    }

    // Insert into database
    insertSession(db, storedSession, chunks);

    // Track if this was new or updated
    if (storedMtime === null) {
      result.added++;
    } else {
      result.updated++;
    }
  } catch (error) {
    console.error(`Error indexing ${filePath}:`, error);
    result.errors++;
  }

  return result;
}

function addResults(target: IndexResult, source: IndexResult): void {
  target.added += source.added;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.errors += source.errors;
}

export async function indexSessions(
  db: Database,
  sessionsDir: string,
): Promise<IndexResult> {
  const result: IndexResult = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  // Collect all candidate files, recursing one level into subdirectories.
  // Pi stores sessions under encoded-path subdirectories:
  //   ~/.pi/agent/sessions/<encoded-cwd>/<session-id>.jsonl
  let filePaths: string[];
  try {
    filePaths = [];
    for (const entry of readdirSync(sessionsDir, { withFileTypes: true })) {
      const entryPath = join(sessionsDir, entry.name);
      if (entry.isDirectory()) {
        try {
          for (const child of readdirSync(entryPath)) {
            filePaths.push(join(entryPath, child));
          }
        } catch {
          // Skip unreadable subdirectories
          void 0;
        }
      } else {
        filePaths.push(entryPath);
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${sessionsDir}:`, error);
    return result;
  }

  const parser = new PiParser();

  for (const filePath of filePaths) {
    // Skip if parser can't handle this file
    const canParse = await parser.canParse(filePath);
    if (!canParse) {
      continue;
    }

    const fileResult = await indexKnownFile(db, filePath, parser);
    addResults(result, fileResult);
  }

  return result;
}

/**
 * Index a single file by path.
 *
 * Efficient alternative to `indexSessions` when the changed file is known
 * (e.g. from an fs.watch event). Avoids scanning the entire source directory.
 */
export async function indexFile(
  db: Database,
  filePath: string,
): Promise<IndexResult> {
  const parser = new PiParser();
  const canParse = await parser.canParse(filePath);
  if (!canParse) {
    return { added: 0, updated: 0, skipped: 0, errors: 0 };
  }
  return indexKnownFile(db, filePath, parser);
}
