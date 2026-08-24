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
  /** Structured details attached to custom_message entries */
  details?: Record<string, unknown>;
}

/** How an agent skill ended up in a session: who loaded it and how. */
export type SkillActor = "user" | "agent";

/** How a skill was invoked or discovered. */
export type SkillDetail = "slash" | "autocomplete" | null;

/** A skill referenced by a session, detected from invocations or SKILL.md reads. */
export interface SkillUsage {
  /** Skill directory name, e.g. "vitest". */
  name: string;
  /** Absolute path to SKILL.md, when known. */
  path: string | null;
  /** Actor who loaded this skill: user injected it, agent read it. */
  actor: SkillActor;
  /** How the skill was discovered: slash (user typed /skill), autocomplete, or null (read). */
  detail?: SkillDetail;
  /** Skill description, when known (hook details or SKILL.md frontmatter). */
  description?: string | null;
}

/** A catalog row matched by fuzzy skill search. */
export interface SkillMatch {
  name: string;
  description: string | null;
  path: string | null;
  score: number;
}

/** Searchable session metadata with the Pi entry that defines it. */
export interface SessionMetadata {
  sourceType: "session_info" | "label";
  textContent: string;
  entryId?: string;
  parentEntryId?: string;
  timestamp?: string;
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
  /** Current title and active checkpoints resolved from Pi metadata entries. */
  metadata: SessionMetadata[];
  /** Skills used in this session (injected skill blocks and SKILL.md reads). */
  skills: SkillUsage[];
  /** ID of parent session (if this session was forked from another) */
  parentSessionId?: string;
}
