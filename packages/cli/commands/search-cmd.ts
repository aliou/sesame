/**
 * Search command - search for sessions
 */

import { join } from "node:path";
import {
  getSkillsForSessions,
  getXDGPaths,
  loadConfig,
  openDatabase,
  parseRelativeDate,
  type SearchOptions,
  search,
} from "@aliou/sesame";

function normalizeScore(rawScore: number): string {
  // BM25 returns negative scores where more negative = better match
  // Convert to 0-1 range for display
  const normalized = Math.min(1, Math.abs(rawScore) / 20);
  return normalized.toFixed(2);
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
    } else if (arg === "--skill") {
      options.skill = args[++i];
    } else if (arg === "--skill-path") {
      options.skillPath = args[++i];
    } else if (arg === "--exclude") {
      options.exclude ??= [];
      options.exclude.push(args[++i]);
    } else if (arg === "--json") {
      options.json = true;
    } else if (!arg.startsWith("-")) {
      query = arg;
    }
  }

  // Load config (not strictly needed for search, but keeps consistency)
  await loadConfig();

  // Open database
  const paths = getXDGPaths();
  const dbPath = join(paths.data, "index.sqlite");
  const db = openDatabase(dbPath);

  try {
    const results = search(db, query, options);
    const displayQuery = query?.trim() || "*";

    if (results.length === 0) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              query: displayQuery,
              resultCount: 0,
              results: [],
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`No sessions found matching "${displayQuery}"`);
      }
      return;
    }

    const skillsBySession = getSkillsForSessions(
      db,
      results.map((r) => r.sessionId),
    );
    const skillNames = (sessionId: string): string[] => [
      ...new Set(
        (skillsBySession.get(sessionId) ?? []).map((skill) => skill.name),
      ),
    ];

    // Output results
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            query: displayQuery,
            resultCount: results.length,
            results: results.map((r) => ({
              sessionId: r.sessionId,
              source: r.source,
              path: r.path,
              cwd: r.cwd,
              name: r.name,
              score: Number.parseFloat(normalizeScore(r.score)),
              created: r.createdAt,
              modified: r.modifiedAt,
              matchedSnippet: r.matchedSnippet,
              matchMode: r.matchMode,
              matchedType: r.matchedType,
              matchedEntryId: r.matchedEntryId,
              matchedAt: r.matchedAt,
              skills: skillNames(r.sessionId),
            })),
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        `Found ${results.length} sessions matching "${displayQuery}"\n`,
      );

      for (const result of results) {
        const score = normalizeScore(result.score);
        const name = result.name || "Unnamed";
        const date = result.modifiedAt
          ? new Date(result.modifiedAt).toISOString().split("T")[0]
          : "unknown";

        console.log(`  [${score}] ${result.sessionId} (${name}) - ${date}`);
        if (result.cwd) {
          console.log(`         ${result.cwd}`);
        }
        const skills = skillNames(result.sessionId);
        if (skills.length > 0) {
          console.log(`         skills: ${skills.join(", ")}`);
        }
        console.log(`         "${result.matchedSnippet}"\n`);
      }
    }
  } finally {
    db.close();
  }
}
