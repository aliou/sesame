/**
 * Normalized session types
 * These types are format-agnostic and represent the parsed structure
 * that all session parsers produce.
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
}

export interface ParsedSession {
  id: string;
  /** Parser ID that produced this session */
  source: string;
  /** Working directory when session was created */
  cwd?: string;
  /** Human-readable session name */
  name?: string;
  createdAt: string;
  modifiedAt: string;
  turns: Turn[];
}

/**
 * Session parser interface
 */
export interface SessionParser {
  /** Unique identifier for this parser (e.g., "pi") */
  id: string;

  /** Detect whether a file/directory belongs to this parser */
  canParse(path: string): Promise<boolean>;

  /** Parse a session file into a normalized structure */
  parse(path: string): Promise<ParsedSession>;
}
