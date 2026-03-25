/**
 * Normalized Pi session types
 * These types represent the parsed structure produced by PiParser.
 */

export interface CodeBlock {
  language?: string;
  content: string;
  /** Source of the code block: "tool:write", "tool:edit", "tool:bash", "inline", etc. */
  source: string;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface Turn {
  role: "user" | "assistant" | "system";
  /** Plain text content */
  textContent: string;
  /** Extracted code blocks (from tool calls, inline code, etc.) */
  codeBlocks: CodeBlock[];
  /** Structured tool call metadata */
  toolCalls: ToolCall[];
  /** Tool name for tool result turns (role="system") */
  toolName?: string;
  /** Whether this tool result represents an error (only for tool result turns) */
  isError?: boolean;
  /** Entry ID from the JSONL (for tree structure) */
  entryId?: string;
  /** Parent entry ID from the JSONL (for tree structure) */
  parentEntryId?: string;
  /** ISO timestamp from the entry */
  timestamp?: string;
  /** Source entry type (message, custom_message, compaction, etc.) */
  sourceType?: string;
  /** Custom type identifier for custom_message entries */
  customType?: string;
}

export interface ParsedSession {
  id: string;
  /** Source parser ID (`"pi"`) */
  source: string;
  /** Working directory when session was created */
  cwd?: string;
  /** Human-readable session name */
  name?: string;
  createdAt: string;
  modifiedAt: string;
  turns: Turn[];
  /** ID of parent session (if this session was forked from another) */
  parentSessionId?: string;
}
