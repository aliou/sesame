/** Allowlist of tool @param names that are filterable in queries. */
export const TOOL_ARG_ALLOWLIST: Record<string, readonly string[]> = {
  bash: ["command"],
  read: ["path"],
  write: ["path"],
  edit: ["path"],
  find: ["pattern", "path"],
  grep: ["pattern", "path"],
  ls: ["path"],
  find_sessions: ["query", "cwd"],
  list_sessions: ["cwd"],
  read_session: ["goal"],
  read_url: ["url"],
  synthetic_web_search: ["query"],
  process: ["action", "name"],
} as const;

export interface ToolArgFilter {
  /** Tool name in quotes (exact match). */
  tool: string;
  /** Parameter key in quotes (exact match). */
  key: string;
  /** Filter value (like pattern). */
  value: string;
}

/** Case-insensitive check if a tool is allowed. */
export function isAllowedToolArg(tool: string, key: string): boolean {
  const toolKey = tool.toLowerCase();
  const keys = TOOL_ARG_ALLOWLIST[toolKey];
  if (!keys) return false;
  return keys.includes(key.toLowerCase());
}

/**
 * Extract tool args using the allowlist.
 *
 * Returns an array of {key, value} for allowed, filterable params.
 * Strings are kept (trimmed, empty skipped); number/boolean scalars are
 * JSON-stringified; objects, arrays, null, and undefined are skipped.
 */
export function extractToolArgs(
  toolName: string,
  args: Record<string, unknown>,
): Array<{ key: string; value: string }> {
  const toolKey = toolName.toLowerCase();
  const allowedKeys = TOOL_ARG_ALLOWLIST[toolKey];

  if (!allowedKeys || allowedKeys.length === 0) {
    return [];
  }

  const result: Array<{ key: string; value: string }> = [];

  for (const key of allowedKeys) {
    const value = args[key];

    // Skip empty string values
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    // String values: keep as-is, trimmed
    if (typeof value === "string") {
      result.push({ key, value: value.trim() });
      continue;
    }

    // Non-null scalars: JSON.stringify
    if (typeof value === "number" || typeof value === "boolean") {
      result.push({ key, value: JSON.stringify(value) });
    }

    // Objects/arrays/null/undefined are not filterable; skip them.
  }

  return result;
}
