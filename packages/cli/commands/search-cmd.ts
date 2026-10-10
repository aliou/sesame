/**
 * sesame search [query] - rank sessions with BM25, or browse recent ones.
 */

import {
  type Database,
  getSkillsForSessions,
  getStats,
  type SearchOptions,
  type SearchResult,
  search,
  skillNameExists,
  TOOL_ARG_ALLOWLIST,
  type ToolArgFilter,
} from "@aliou/sesame";
import {
  boolean,
  command,
  number,
  positional,
  string,
} from "@drizzle-team/brocli";
import { decodeRepeated } from "../argv";
import { loadSesameConfig, openIndex, parseDateFlag } from "../context";
import { label } from "../kit/colors";
import { usageError } from "../kit/errors";
import { isJson, writeHuman, writeJson, writeStderr } from "../kit/output";

const searchOptions = {
  query: positional("query").desc(
    'Search text. Quote multi-word queries. Omit or use "*" to browse',
  ),
  cwd: string("cwd").desc("Only sessions whose cwd starts with this path"),
  after: string("after").desc(
    "Sessions modified after date (7d, 2w, 1m, YYYY-MM-DD)",
  ),
  before: string("before").desc("Sessions modified before date"),
  limit: number("limit").int().min(1).default(10).desc("Max results"),
  tools: boolean("tools").desc("Search only tool-call chunks"),
  tool: string("tool").desc("Search tool calls of this tool name"),
  via: string("via").desc(
    "Only tool calls nested inside this tool (e.g. codemode)",
  ),
  path: string("path").desc("Only tool calls that mention this path"),
  skill: string("skill").desc(
    "Sessions that used a skill: exact name, else fuzzy over name and description",
  ),
  skillPath: string("skill-path").desc(
    "Sessions that used a skill whose SKILL.md path contains this text",
  ),
  arg: string("arg").desc(
    "Tool called with a parameter, as tool:key=value (repeatable)",
  ),
  exclude: string("exclude").desc("Exclude a session id (repeatable)"),
};

type SearchFlags = {
  query?: string;
  cwd?: string;
  after?: string;
  before?: string;
  limit: number;
  tools?: boolean;
  tool?: string;
  via?: string;
  path?: string;
  skill?: string;
  skillPath?: string;
  arg?: string;
  exclude?: string;
};

export const searchCommand = command({
  name: "search",
  desc: "Search sessions with BM25, or browse recent sessions",
  options: searchOptions,
  handler: async (flags: SearchFlags) => runSearch(flags),
});

/** Parse one --arg value (tool:key=value) against the allowlist. */
export function parseToolArg(spec: string): ToolArgFilter {
  const colon = spec.indexOf(":");
  const equals = spec.indexOf("=", colon + 1);
  const tool = spec.slice(0, Math.max(colon, 0)).toLowerCase();
  const key = equals > colon ? spec.slice(colon + 1, equals).toLowerCase() : "";
  const value = equals > colon ? spec.slice(equals + 1) : "";
  if (!tool || !key || !value) {
    throw usageError(
      `invalid --arg "${spec}": expected tool:key=value`,
      "INVALID_INPUT",
    );
  }
  const allowedKeys = TOOL_ARG_ALLOWLIST[tool];
  if (!allowedKeys) {
    throw usageError(
      `unknown tool "${tool}" for --arg (allowed: ${Object.keys(TOOL_ARG_ALLOWLIST).join(", ")})`,
      "INVALID_INPUT",
    );
  }
  if (!allowedKeys.includes(key)) {
    throw usageError(
      `unknown parameter "${key}" for --arg tool "${tool}" (allowed: ${allowedKeys.join(", ")})`,
      "INVALID_INPUT",
    );
  }
  return { tool, key, value };
}

function buildSearchOptions(flags: SearchFlags): SearchOptions {
  const toolArgs = decodeRepeated(flags.arg).map(parseToolArg);
  const exclude = decodeRepeated(flags.exclude);
  return {
    limit: flags.limit,
    cwd: flags.cwd,
    after: parseDateFlag("--after", flags.after),
    before: parseDateFlag("--before", flags.before),
    toolsOnly: flags.tools,
    toolName: flags.tool,
    via: flags.via,
    pathFilter: flags.path,
    skillPath: flags.skillPath,
    toolArgs: toolArgs.length > 0 ? toolArgs : undefined,
    exclude: exclude.length > 0 ? exclude : undefined,
  };
}

/** --skill: exact skill name when indexed, otherwise fuzzy skill search. */
function applySkillFilter(
  db: Database,
  options: SearchOptions,
  skill: string | undefined,
): void {
  if (!skill) return;
  if (skillNameExists(db, skill)) options.skill = skill;
  else options.skillQuery = skill;
}

async function runSearch(flags: SearchFlags): Promise<void> {
  const options = buildSearchOptions(flags);
  await loadSesameConfig();
  const db = openIndex();
  try {
    applySkillFilter(db, options, flags.skill);
    const results = search(db, flags.query, options);
    const query = flags.query?.trim() || "*";
    const skillsBySession = getSkillsForSessions(
      db,
      results.map((result) => result.sessionId),
    );
    const skillNames = (sessionId: string): string[] => [
      ...new Set(
        (skillsBySession.get(sessionId) ?? []).map((skill) => skill.name),
      ),
    ];

    if (isJson()) {
      writeJson({
        query,
        resultCount: results.length,
        results: results.map((result) =>
          toJsonResult(result, skillNames(result.sessionId)),
        ),
      });
    } else {
      writeHuman(renderResults(query, results, skillNames));
    }
    if (results.length === 0) hintWhenEmpty(db);
  } finally {
    db.close();
  }
}

function hintWhenEmpty(db: Database): void {
  if (getStats(db).sessionCount > 0) return;
  writeStderr("hint: the index is empty; run 'sesame index' first");
}

function normalizeScore(rawScore: number): number {
  // BM25 scores are negative; more negative is better. Map to 0-1.
  return Number(Math.min(1, Math.abs(rawScore) / 20).toFixed(2));
}

function toJsonResult(result: SearchResult, skills: string[]) {
  return {
    sessionId: result.sessionId,
    source: result.source,
    path: result.path,
    cwd: result.cwd,
    name: result.name,
    score: normalizeScore(result.score),
    created: result.createdAt,
    modified: result.modifiedAt,
    matchedSnippet: result.matchedSnippet,
    matchMode: result.matchMode,
    matchedType: result.matchedType,
    matchedEntryId: result.matchedEntryId,
    matchedAt: result.matchedAt,
    skills,
  };
}

export function renderResults(
  query: string,
  results: SearchResult[],
  skillNames: (sessionId: string) => string[],
): string {
  if (results.length === 0) return `No sessions found matching "${query}"`;
  const blocks = results.map((result) => {
    const score = normalizeScore(result.score).toFixed(2);
    const date = result.modifiedAt
      ? new Date(result.modifiedAt).toISOString().split("T")[0]
      : "unknown";
    const lines = [
      `${label(`[${score}]`)} ${result.sessionId} (${result.name || "Unnamed"}) ${label(date)}`,
    ];
    if (result.cwd) lines.push(`       ${label(result.cwd)}`);
    const skills = skillNames(result.sessionId);
    if (skills.length > 0) {
      lines.push(`       ${label("skills:")} ${skills.join(", ")}`);
    }
    lines.push(`       "${result.matchedSnippet}"`);
    return lines.join("\n");
  });
  return `Found ${results.length} sessions matching "${query}"\n\n${blocks.join("\n\n")}`;
}
