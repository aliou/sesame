import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { type Database, openDatabase, type SearchOptions, search } from "./db";

type Request =
  | { id: number; operation: "search"; query?: string; options?: SearchOptions }
  | { id: number; operation: "list"; cwd: string; limit: number; depth: number }
  | { id: number; operation: "get"; sessionId: string }
  | { id: number; operation: "names"; token: string; cwd?: string };

const port = parentPort;
if (!port) throw new Error("Search worker requires a parent port");
const channel = port;

let db: Database | undefined;
function database(): Database {
  if (!db) {
    const { dbPath } = workerData as { dbPath: string };
    mkdirSync(dirname(dbPath), { recursive: true });
    db = openDatabase(dbPath);
    db.exec("PRAGMA query_only = ON");
  }
  return db;
}

channel.on("message", (request: Request) => {
  try {
    const connection = database();
    let result: unknown;
    switch (request.operation) {
      case "search": {
        const matches = search(connection, request.query, request.options);
        const counts = matches.length
          ? (connection
              .prepare(
                `SELECT id, message_count FROM sessions WHERE id IN (${matches.map(() => "?").join(",")})`,
              )
              .all(...matches.map((match) => match.sessionId)) as Array<{
              id: string;
              message_count: number;
            }>)
          : [];
        const byId = new Map(counts.map((row) => [row.id, row.message_count]));
        result = matches.map((match) => ({
          ...match,
          messageCount: byId.get(match.sessionId) ?? 0,
        }));
        break;
      }
      case "list": {
        const { cwd, limit, depth } = request;
        // Match complete path components and apply depth before LIMIT.
        // Escaping matters for directories containing SQL LIKE wildcards.
        const prefix = `${cwd.replace(/[\\%_]/g, "\\$&")}/%`;
        const rows = connection
          .prepare(
            `SELECT id, path, cwd, name, created_at, modified_at, message_count
             FROM sessions WHERE cwd = ? OR (cwd LIKE ? ESCAPE '\\'
               AND length(substr(cwd, length(?) + 2)) -
                   length(replace(substr(cwd, length(?) + 2), '/', '')) < ?)
             ORDER BY modified_at DESC LIMIT ?`,
          )
          .all(cwd, depth > 0 ? prefix : "", cwd, cwd, depth, limit) as Array<{
          cwd: string | null;
        }>;
        result = rows;
        break;
      }
      case "get":
        result =
          connection
            .prepare(
              "SELECT id, cwd, name, created_at, modified_at FROM sessions WHERE id = ?",
            )
            .get(request.sessionId) ?? null;
        break;
      case "names":
        result = connection
          .prepare(
            `SELECT id, path, cwd, name, created_at, modified_at, message_count
             FROM sessions WHERE (? IS NULL OR cwd LIKE ?) AND name LIKE ?
             ORDER BY modified_at DESC`,
          )
          .all(
            request.cwd ? `${request.cwd}%` : null,
            request.cwd ? `${request.cwd}%` : null,
            `%${request.token}%`,
          );
        break;
    }
    channel.postMessage({ id: request.id, result });
  } catch (error) {
    channel.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
