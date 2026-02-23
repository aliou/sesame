import type { ToolCall } from "../types/session";

/**
 * Format a tool call into structured searchable text.
 *
 * Each tool type gets a specific format optimized for search:
 * - write/create: tool name + path + content
 * - edit: tool name + path + old/new
 * - bash: tool name + command + output
 * - read: tool name + path + content
 * - generic: tool name + args + result
 */
export function formatToolCall(tc: ToolCall): string {
  const name = tc.name.toLowerCase();

  switch (name) {
    case "write":
    case "create":
    case "write_file":
    case "create_file": {
      const path = extractArg(tc, ["path", "file_path", "filePath"]);
      const content = extractArg(tc, [
        "content",
        "file_content",
        "fileContent",
      ]);
      return buildText([
        `tool: ${tc.name}`,
        path ? `path: ${path}` : null,
        content ? `content:\n${content}` : null,
        tc.result ? `result:\n${tc.result}` : null,
      ]);
    }

    case "edit":
    case "edit_file": {
      const path = extractArg(tc, ["path", "file_path", "filePath"]);
      const oldText = extractArg(tc, [
        "old",
        "oldText",
        "old_text",
        "old_string",
        "search",
      ]);
      const newText = extractArg(tc, [
        "new",
        "newText",
        "new_text",
        "new_string",
        "replace",
      ]);
      return buildText([
        `tool: ${tc.name}`,
        path ? `path: ${path}` : null,
        oldText ? `old:\n${oldText}` : null,
        newText ? `new:\n${newText}` : null,
        tc.result ? `result:\n${tc.result}` : null,
      ]);
    }

    case "bash":
    case "shell":
    case "run_command": {
      const command = extractArg(tc, ["command", "cmd", "script"]);
      const output = tc.result;
      return buildText([
        `tool: ${tc.name}`,
        command ? `command: ${command}` : null,
        output ? `output:\n${output}` : null,
      ]);
    }

    case "read":
    case "read_file": {
      const path = extractArg(tc, ["path", "file_path", "filePath"]);
      return buildText([
        `tool: ${tc.name}`,
        path ? `path: ${path}` : null,
        tc.result ? `content:\n${tc.result}` : null,
      ]);
    }

    default: {
      // Generic: dump all args + result
      const argsText = Object.entries(tc.args)
        .map(
          ([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
        )
        .join("\n");
      return buildText([
        `tool: ${tc.name}`,
        argsText || null,
        tc.result ? `result:\n${tc.result}` : null,
      ]);
    }
  }
}

/**
 * Extract paths from a tool call for path-based search.
 * Returns all file paths found in the tool call args.
 */
export function extractPaths(tc: ToolCall): string[] {
  const paths: string[] = [];
  const pathValue = extractArg(tc, ["path", "file_path", "filePath"]);
  if (pathValue) paths.push(pathValue);
  return paths;
}

function extractArg(tc: ToolCall, keys: string[]): string | null {
  for (const key of keys) {
    const val = tc.args[key];
    if (val != null) {
      return typeof val === "string" ? val : JSON.stringify(val);
    }
  }
  return null;
}

function buildText(parts: (string | null)[]): string {
  return parts.filter(Boolean).join("\n");
}
