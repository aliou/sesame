/**
 * Search command - search for sessions
 */

import { join } from "node:path";
import { openDatabase, type SearchOptions, search } from "../storage/db";
import { loadConfig } from "../utils/config";
import { parseRelativeDate } from "../utils/date";
import { getXDGPaths } from "../utils/xdg";

function normalizeScore(rawScore: number): string {
  // BM25 returns negative scores where more negative = better match
  // Convert to 0-1 range for display
  const normalized = Math.min(1, Math.abs(rawScore) / 20);
  return normalized.toFixed(2);
}

function printUsage() {
  console.log(`Usage: sesame search <query> [options]

Options:
  --cwd <path>       Filter by project directory
  --after <date>     Filter sessions after date (7d, 2w, 1m, or ISO date)
  --before <date>    Filter sessions before date
  --limit <n>        Max results (default: 10)
  --tools            Search only tool call chunks
  --tool <name>      Search specific tool type
  --path <file>      Find sessions that touched a file
  --json             Output as JSON`);
}

export default async function searchCommand(args: string[]): Promise<void> {
  // Parse arguments
  let query: string | undefined;
  const options: SearchOptions = {
    limit: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--cwd") {
      options.cwd = args[++i];
    } else if (arg === "--after") {
      const dateStr = args[++i];
      options.after = parseRelativeDate(dateStr);
    } else if (arg === "--before") {
      const dateStr = args[++i];
      options.before = parseRelativeDate(dateStr);
    } else if (arg === "--limit") {
      options.limit = Number.parseInt(args[++i], 10);
    } else if (arg === "--tools") {
      options.toolsOnly = true;
    } else if (arg === "--tool") {
      options.toolName = args[++i];
    } else if (arg === "--path") {
      options.pathFilter = args[++i];
    } else if (arg === "--json") {
      options.json = true;
    } else if (!arg.startsWith("-")) {
      query = arg;
    }
  }

  // Validate query
  if (!query) {
    printUsage();
    process.exit(1);
  }

  // Load config (not strictly needed for search, but keeps consistency)
  await loadConfig();

  // Open database
  const paths = getXDGPaths();
  const dbPath = join(paths.data, "index.sqlite");
  const db = openDatabase(dbPath);

  try {
    const results = search(db, query, options);

    if (results.length === 0) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              query,
              resultCount: 0,
              results: [],
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`No sessions found matching "${query}"`);
      }
      return;
    }

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            query,
            resultCount: results.length,
            results: results.map((r) => ({
              sessionId: r.sessionId,
              source: r.source,
              path: r.path,
              cwd: r.cwd,
              name: r.name,
              score: Number.parseFloat(normalizeScore(r.score)),
              created: r.createdAt,
              matchedSnippet: r.matchedSnippet,
            })),
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`Found ${results.length} sessions matching "${query}"\n`);

      for (const result of results) {
        const score = normalizeScore(result.score);
        const name = result.name || "Unnamed";
        const date = result.createdAt
          ? new Date(result.createdAt).toISOString().split("T")[0]
          : "unknown";

        console.log(`  [${score}] ${result.sessionId} (${name}) - ${date}`);
        if (result.cwd) {
          console.log(`         ${result.cwd}`);
        }
        console.log(`         "${result.matchedSnippet}"\n`);
      }
    }
  } finally {
    db.close();
  }
}
