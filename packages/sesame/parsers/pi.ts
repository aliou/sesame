/**
 * Parser for Pi's JSONL session files
 */

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type { ParsedSession, SessionParser, ToolCall, Turn } from "../types/session";

interface SessionHeader {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd?: string;
  parentSession?: string;
}

interface SessionInfo {
  type: "session_info";
  name: string;
}

interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

interface ToolCallContent {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

type ContentBlock = TextContent | ImageContent | ToolCallContent | ThinkingContent;

interface UserMessage {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: "user";
    content: string | ContentBlock[];
    timestamp?: number;
  };
}

interface AssistantMessage {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: "assistant";
    content: ContentBlock[];
    provider?: string;
    model?: string;
    usage?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      totalTokens: number;
      cost: { total: number };
    };
    stopReason?: string;
    timestamp?: number;
  };
}

interface ToolResultMessage {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: "toolResult";
    toolCallId: string;
    toolName: string;
    isError?: boolean;
    content: ContentBlock[];
    timestamp?: number;
  };
}

interface BashExecutionMessage {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: {
    role: "bashExecution";
    command: string;
    output: string;
    exitCode?: number;
    cancelled?: boolean;
    truncated?: boolean;
    timestamp?: number;
  };
}

interface CompactionEntry {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  firstKeptEntryId?: string;
  tokensBefore?: number;
}

interface BranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  fromId: string;
  summary: string;
}

interface CustomEntry {
  type: "custom";
  customType: string;
  data?: unknown;
  id: string;
  parentId: string | null;
  timestamp: string;
}

interface CustomMessageEntry {
  type: "custom_message";
  customType: string;
  content: string | ContentBlock[];
  display: boolean;
  details?: unknown;
  id: string;
  parentId: string | null;
  timestamp: string;
}

interface ModelChangeEntry {
  type: "model_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  provider: string;
  modelId: string;
}

interface ThinkingLevelChangeEntry {
  type: "thinking_level_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  thinkingLevel: string;
}

interface LabelEntry {
  type: "label";
  id: string;
  parentId: string | null;
  timestamp: string;
  targetId: string;
  label?: string;
}

type JSONLLine =
  | SessionHeader
  | SessionInfo
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CompactionEntry
  | BranchSummaryEntry
  | CustomEntry
  | CustomMessageEntry
  | ModelChangeEntry
  | ThinkingLevelChangeEntry
  | LabelEntry;

/**
 * Extract text content from content blocks
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

/**
 * Extract session ID from a Pi session file path.
 * Pi session filenames contain the UUID: 2026-02-23T08-52-01-947Z_34f5d893-8206-4593-a056-9a9093076a17.jsonl
 */
function extractSessionIdFromPath(path: string): string | undefined {
  const filename = basename(path, ".jsonl");
  const underscoreIndex = filename.lastIndexOf("_");
  if (underscoreIndex !== -1) {
    return filename.slice(underscoreIndex + 1);
  }
  return undefined;
}

export class PiParser implements SessionParser {
  id = "pi";

  async canParse(path: string): Promise<boolean> {
    try {
      // Check file extension
      if (!path.endsWith(".jsonl")) {
        return false;
      }

      // Read first line and check for session header
      const content = await readFile(path, "utf-8");
      const firstLine = content.split("\n")[0];
      if (!firstLine) {
        return false;
      }

      const parsed = JSON.parse(firstLine) as JSONLLine;
      return parsed.type === "session";
    } catch {
      return false;
    }
  }

  async parse(path: string): Promise<ParsedSession> {
    const content = await readFile(path, "utf-8");
    const fileStat = await stat(path);
    const lines = content.split("\n").filter((line) => line.trim());

    let sessionId = basename(path, ".jsonl");
    let sessionCwd: string | undefined;
    let sessionName: string | undefined;
    let createdAt = new Date().toISOString();
    let parentSessionId: string | undefined;
    const modifiedAt = fileStat.mtime.toISOString();
    const turns: Turn[] = [];

    for (const [index, line] of lines.entries()) {
      try {
        const parsed = JSON.parse(line) as JSONLLine;

        switch (parsed.type) {
          case "session": {
            const header = parsed as SessionHeader;
            sessionId = header.id;
            sessionCwd = header.cwd;
            createdAt = header.timestamp;
            // Extract parent session ID from path if present
            if (header.parentSession) {
              parentSessionId = extractSessionIdFromPath(header.parentSession);
            }
            break;
          }

          case "session_info": {
            const info = parsed as SessionInfo;
            sessionName = info.name;
            break;
          }

          case "message": {
            const msg = parsed as
              | UserMessage
              | AssistantMessage
              | ToolResultMessage
              | BashExecutionMessage;

            const baseTurn = {
              entryId: msg.id,
              parentEntryId: msg.parentId ?? undefined,
              timestamp: msg.timestamp,
              sourceType: "message" as const,
            };

            if (msg.message.role === "user") {
              const userMsg = msg as UserMessage;
              const textContent = extractTextContent(userMsg.message.content);
              turns.push({
                role: "user",
                textContent,
                codeBlocks: [],
                toolCalls: [],
                ...baseTurn,
              });
            } else if (msg.message.role === "assistant") {
              const assistantMsg = msg as AssistantMessage;
              const textBlocks = assistantMsg.message.content.filter(
                (c): c is TextContent => c.type === "text",
              );
              const toolCallBlocks = assistantMsg.message.content.filter(
                (c): c is ToolCallContent => c.type === "toolCall",
              );

              const textContent = textBlocks.map((c) => c.text).join("\n");
              const toolCalls: ToolCall[] = toolCallBlocks.map((tc) => ({
                name: tc.name,
                args: tc.arguments,
              }));

              turns.push({
                role: "assistant",
                textContent,
                codeBlocks: [],
                toolCalls,
                ...baseTurn,
              });
            } else if (msg.message.role === "toolResult") {
              const toolResultMsg = msg as ToolResultMessage;
              const textContent = extractTextContent(toolResultMsg.message.content);
              turns.push({
                role: "system",
                textContent,
                codeBlocks: [],
                toolCalls: [],
                toolName: toolResultMsg.message.toolName,
                isError: toolResultMsg.message.isError ?? false,
                ...baseTurn,
              });
            } else if (msg.message.role === "bashExecution") {
              const bashMsg = msg as BashExecutionMessage;
              const textContent = `$ ${bashMsg.message.command}\n${bashMsg.message.output}`;
              turns.push({
                role: "system",
                textContent,
                codeBlocks: [],
                toolCalls: [],
                ...baseTurn,
              });
            }
            break;
          }

          case "custom_message": {
            const customMsg = parsed as CustomMessageEntry;
            const textContent = extractTextContent(customMsg.content);
            // Prefix with customType to make it searchable
            const prefixedContent = `[${customMsg.customType}]\n${textContent}`;
            turns.push({
              role: "system",
              textContent: prefixedContent,
              codeBlocks: [],
              toolCalls: [],
              entryId: customMsg.id,
              parentEntryId: customMsg.parentId ?? undefined,
              timestamp: customMsg.timestamp,
              sourceType: "custom_message",
              customType: customMsg.customType,
            });
            break;
          }

          case "compaction": {
            const compaction = parsed as CompactionEntry;
            turns.push({
              role: "system",
              textContent: compaction.summary,
              codeBlocks: [],
              toolCalls: [],
              entryId: compaction.id,
              parentEntryId: compaction.parentId ?? undefined,
              timestamp: compaction.timestamp,
              sourceType: "compaction",
            });
            break;
          }

          case "branch_summary": {
            const branch = parsed as BranchSummaryEntry;
            turns.push({
              role: "system",
              textContent: branch.summary,
              codeBlocks: [],
              toolCalls: [],
              entryId: branch.id,
              parentEntryId: branch.parentId ?? undefined,
              timestamp: branch.timestamp,
              sourceType: "branch_summary",
            });
            break;
          }

          case "model_change":
          case "thinking_level_change":
          case "custom":
          case "label":
            // Skip metadata/extension state lines (not part of LLM context)
            break;

          default: {
            const lineType = JSON.stringify((parsed as { type?: unknown }).type) ?? '"unknown"';
            console.error(`Warning: Unknown line type at line ${index + 1}: ${lineType}`);
            break;
          }
        }
      } catch (error) {
        console.error(
          `Warning: Failed to parse line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      id: sessionId,
      source: this.id,
      cwd: sessionCwd,
      name: sessionName,
      createdAt,
      modifiedAt,
      turns,
      parentSessionId,
    };
  }
}
