/**
 * Parser for Pi's JSONL session files
 */

import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import type {
  ParsedSession,
  SessionParser,
  ToolCall,
  Turn,
} from "../types/session";

interface SessionHeader {
  type: "session";
  version: number;
  id: string;
  timestamp: string;
  cwd?: string;
}

interface SessionInfo {
  type: "session_info";
  name: string;
}

interface TextContent {
  type: "text";
  text: string;
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

type ContentBlock = TextContent | ToolCallContent | ThinkingContent;

interface UserMessage {
  type: "message";
  message: {
    role: "user";
    content: ContentBlock[];
  };
}

interface AssistantMessage {
  type: "message";
  message: {
    role: "assistant";
    content: ContentBlock[];
  };
}

interface ToolResultMessage {
  type: "message";
  message: {
    role: "toolResult";
    toolCallId: string;
    toolName: string;
    isError?: boolean;
    content: ContentBlock[];
  };
}

interface BashExecutionMessage {
  type: "message";
  message: {
    role: "bashExecution";
    command: string;
    output: string;
    exitCode: number;
  };
}

interface CompactionLine {
  type: "compaction";
  summary: string;
}

type JSONLLine =
  | SessionHeader
  | SessionInfo
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CompactionLine
  | { type: "model_change" | "thinking_level_change" | "custom" };

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

            if (msg.message.role === "user") {
              const userMsg = msg as UserMessage;
              const textBlocks = userMsg.message.content.filter(
                (c): c is TextContent => c.type === "text",
              );
              const textContent = textBlocks.map((c) => c.text).join("\n");
              turns.push({
                role: "user",
                textContent,
                codeBlocks: [],
                toolCalls: [],
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
              });
            } else if (msg.message.role === "toolResult") {
              const toolResultMsg = msg as ToolResultMessage;
              const textBlocks = toolResultMsg.message.content.filter(
                (c): c is TextContent => c.type === "text",
              );
              const textContent = textBlocks.map((c) => c.text).join("\n");
              turns.push({
                role: "system",
                textContent,
                codeBlocks: [],
                toolCalls: [],
                toolName: toolResultMsg.message.toolName,
                isError: toolResultMsg.message.isError ?? false,
              });
            } else if (msg.message.role === "bashExecution") {
              const bashMsg = msg as BashExecutionMessage;
              const textContent = `$ ${bashMsg.message.command}\n${bashMsg.message.output}`;
              turns.push({
                role: "system",
                textContent,
                codeBlocks: [],
                toolCalls: [],
              });
            }
            break;
          }

          case "compaction": {
            const compaction = parsed as CompactionLine;
            turns.push({
              role: "system",
              textContent: compaction.summary,
              codeBlocks: [],
              toolCalls: [],
            });
            break;
          }

          case "model_change":
          case "thinking_level_change":
          case "custom":
            // Skip metadata lines
            break;

          default:
            console.error(
              `Warning: Unknown line type at line ${index + 1}: ${(parsed as Record<string, unknown>).type}`,
            );
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
    };
  }
}
