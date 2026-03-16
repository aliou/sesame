import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";

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

const SesameSearchParams = Type.Object({
  query: Type.String({
    description: "Search query (words, concepts, or phrases)",
  }),
  cwd: Type.Optional(Type.String({ description: "Filter by project directory path" })),
  after: Type.Optional(
    Type.String({
      description: "Filter sessions after date (7d, 2w, 1m, or ISO date)",
    }),
  ),
  before: Type.Optional(
    Type.String({
      description: "Filter sessions before date (7d, 2w, 1m, or ISO date)",
    }),
  ),
  limit: Type.Optional(Type.Number({ description: "Max results (default: 10)" })),
});

type SesameSearchParams = Static<typeof SesameSearchParams>;

export function createSesameSearchTool(pi: ExtensionAPI) {
  return {
    name: "sesame_search",
    label: "Sesame Search",
    description:
      'Search past coding sessions by topic, concept, or keyword using BM25 full-text search. More effective than find_sessions for multi-word queries like "nix infrastructure simplify" or "carousel company website". Supports date and directory filters.',
    parameters: SesameSearchParams,

    async execute(
      _toolCallId: string,
      params: unknown,
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback<unknown> | undefined,
      _ctx: ExtensionContext,
    ) {
      const input = params as SesameSearchParams;

      const args = ["search", input.query, "--json"];
      if (input.cwd) args.push("--cwd", input.cwd);
      if (input.after) args.push("--after", input.after);
      if (input.before) args.push("--before", input.before);
      if (input.limit) args.push("--limit", String(input.limit));

      const result = await pi.exec("sesame", args, {
        signal,
        timeout: 30000,
      });

      if (result.code !== 0) {
        return {
          content: [
            { type: "text", text: `Sesame search failed: ${result.stderr || "unknown error"}` },
          ],
          isError: true,
        };
      }

      let data: SearchResponse;
      try {
        data = JSON.parse(result.stdout) as SearchResponse;
      } catch {
        return {
          content: [{ type: "text", text: result.stdout }],
        };
      }

      if (data.resultCount === 0) {
        return {
          content: [{ type: "text", text: `No sessions found matching "${input.query}"` }],
          details: data,
        };
      }

      let text = `Found ${data.resultCount} sessions matching "${input.query}"\n\n`;
      for (const entry of data.results) {
        text += `[${entry.score}] ${entry.sessionId}`;
        if (entry.name) text += ` (${entry.name})`;
        text += ` - ${entry.created?.split("T")[0] || "unknown date"}\n`;
        if (entry.cwd) text += `  cwd: ${entry.cwd}\n`;
        text += `  path: ${entry.path}\n`;
        text += `  "${entry.matchedSnippet.slice(0, 200)}"\n\n`;
      }

      return {
        content: [{ type: "text", text }],
        details: data,
      };
    },

    renderCall(args: unknown, theme: Theme) {
      const input = args as SesameSearchParams;

      let text = theme.fg("toolTitle", theme.bold("sesame_search "));
      text += theme.fg("muted", `"${input.query}"`);
      if (input.cwd) text += theme.fg("dim", ` --cwd ${input.cwd}`);
      if (input.after) text += theme.fg("dim", ` --after ${input.after}`);
      if (input.before) text += theme.fg("dim", ` --before ${input.before}`);
      if (input.limit) text += theme.fg("dim", ` --limit ${input.limit}`);
      return new Text(text, 0, 0);
    },

    renderResult(
      result: AgentToolResult<unknown>,
      { isPartial }: ToolRenderResultOptions,
      theme: Theme,
    ) {
      if (isPartial) {
        return new Text(theme.fg("muted", "Searching..."), 0, 0);
      }

      const data = result.details as SearchResponse | undefined;
      if (!data) {
        const text = result.content[0];
        return new Text(text?.type === "text" ? text.text : "", 0, 0);
      }

      if (data.resultCount === 0) {
        return new Text(theme.fg("warning", `No sessions found matching "${data.query}"`), 0, 0);
      }

      const lines = [
        theme.fg("success", `Found ${data.resultCount} sessions matching "${data.query}"`),
      ];
      for (const entry of data.results) {
        const name = entry.name ? ` (${entry.name})` : "";
        const date = entry.created?.split("T")[0] || "";
        lines.push(
          `  ${theme.fg("accent", `[${entry.score}]`)} ${entry.sessionId.slice(0, 8)}${name} ${theme.fg("dim", date)}`,
        );
      }
      return new Text(lines.join("\n"), 0, 0);
    },
  };
}
