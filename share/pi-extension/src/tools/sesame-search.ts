import {
  Type,
  type ExtensionAPI,
  type ToolDefinition,
} from "@mariozechner/pi-coding-agent";

interface SearchResult {
  sessionId: string;
  source: string;
  path: string;
  cwd: string | null;
  name: string | null;
  score: number;
  created: string | null;
  matchedSnippet: string;
}

interface SearchResponse {
  query: string;
  resultCount: number;
  results: SearchResult[];
}

export function createSesameSearchTool(
  pi: ExtensionAPI,
): ToolDefinition {
  return {
    name: "sesame_search",
    description:
      'Search past coding sessions by topic, concept, or keyword using BM25 full-text search. More effective than find_sessions for multi-word queries like "nix infrastructure simplify" or "carousel company website". Supports date and directory filters.',
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (words, concepts, or phrases)",
      }),
      cwd: Type.Optional(
        Type.String({ description: "Filter by project directory path" }),
      ),
      after: Type.Optional(
        Type.String({
          description:
            "Filter sessions after date (7d, 2w, 1m, or ISO date)",
        }),
      ),
      before: Type.Optional(
        Type.String({
          description:
            "Filter sessions before date (7d, 2w, 1m, or ISO date)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default: 10)" }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["search", params.query, "--json"];
      if (params.cwd) args.push("--cwd", params.cwd);
      if (params.after) args.push("--after", params.after);
      if (params.before) args.push("--before", params.before);
      if (params.limit) args.push("--limit", String(params.limit));

      const result = await pi.exec("sesame", args, {
        signal,
        timeout: 30000,
      });

      if (result.code !== 0) {
        return {
          output: `Sesame search failed: ${result.stderr || "unknown error"}`,
          isError: true,
        };
      }

      let data: SearchResponse;
      try {
        data = JSON.parse(result.stdout) as SearchResponse;
      } catch {
        return { output: result.stdout };
      }

      if (data.resultCount === 0) {
        return {
          output: `No sessions found matching "${params.query}"`,
          details: data,
        };
      }

      let text = `Found ${data.resultCount} sessions matching "${params.query}"\n\n`;
      for (const r of data.results) {
        text += `[${r.score}] ${r.sessionId}`;
        if (r.name) text += ` (${r.name})`;
        text += ` - ${r.created?.split("T")[0] || "unknown date"}\n`;
        if (r.cwd) text += `  cwd: ${r.cwd}\n`;
        text += `  path: ${r.path}\n`;
        text += `  "${r.matchedSnippet?.slice(0, 200) || ""}"\n\n`;
      }

      return {
        output: text,
        details: data,
      };
    },

    renderCall(params, theme) {
      let text = theme.fg("toolTitle", theme.bold("sesame_search "));
      text += theme.fg("muted", `"${params.query}"`);
      if (params.cwd) text += theme.fg("dim", ` --cwd ${params.cwd}`);
      if (params.after) text += theme.fg("dim", ` --after ${params.after}`);
      if (params.before)
        text += theme.fg("dim", ` --before ${params.before}`);
      if (params.limit) text += theme.fg("dim", ` --limit ${params.limit}`);
      return text;
    },

    renderResult(result, { isPartial }, theme) {
      if (isPartial) {
        return theme.fg("muted", "Searching...");
      }

      const data = result.details as SearchResponse | undefined;
      if (!data) return undefined;

      if (data.resultCount === 0) {
        return theme.fg("warning", `No sessions found matching "${data.query}"`);
      }

      const lines = [
        theme.fg(
          "success",
          `Found ${data.resultCount} sessions matching "${data.query}"`,
        ),
      ];
      for (const r of data.results) {
        const name = r.name ? ` (${r.name})` : "";
        const date = r.created?.split("T")[0] || "";
        lines.push(
          `  ${theme.fg("accent", `[${r.score}]`)} ${r.sessionId.slice(0, 8)}${name} ${theme.fg("dim", date)}`,
        );
      }
      return lines.join("\n");
    },
  };
}
