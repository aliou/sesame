import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  type Database,
  deleteSession,
  getSessionMtime,
  insertSession,
  type StoredChunk,
  type StoredSession,
} from "../storage/db";
import type { SessionParser } from "../types/session";
import { formatToolCall } from "./format-tool-call";

function readFirstLine(filePath: string): string | null {
  try {
    const text = readFileSync(filePath, "utf-8");
    const newlineIndex = text.indexOf("\n");
    return newlineIndex === -1 ? text : text.slice(0, newlineIndex);
  } catch {
    return null;
  }
}

export interface IndexResult {
  added: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function indexSessions(
  db: Database,
  sessionsDir: string,
  parser: SessionParser,
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
        }
      } else {
        filePaths.push(entryPath);
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${sessionsDir}:`, error);
    return result;
  }

  for (const filePath of filePaths) {
    // Skip if parser can't handle this file
    const canParse = await parser.canParse(filePath);
    if (!canParse) {
      continue;
    }

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
            continue;
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
            tool_name: null,
            seq: seq++,
            content: turn.textContent,
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
  }

  return result;
}
