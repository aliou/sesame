import { unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, test } from "vitest";
import { createSessionBuilder } from "../test-helpers/session-factory.ts";
import { PiParser } from "./pi.ts";

describe("PiParser", () => {
  const parser = new PiParser();
  let tempFiles: string[] = [];

  afterEach(() => {
    // Clean up all temp files
    for (const file of tempFiles) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
    tempFiles = [];
  });

  async function createTempFile(content: string): Promise<string> {
    const path = `/tmp/sesame-test-${Date.now()}-${Math.random()}.jsonl`;
    await writeFile(path, content, "utf-8");
    tempFiles.push(path);
    return path;
  }

  describe("canParse", () => {
    test("returns true for .jsonl files with valid session header", async () => {
      const content = createSessionBuilder().withHeader().build();
      const path = await createTempFile(content);

      const result = await parser.canParse(path);
      expect(result).toBe(true);
    });

    test("returns false for non-.jsonl files", async () => {
      const content = createSessionBuilder().withHeader().build();
      const path = `/tmp/sesame-test-${Date.now()}.txt`;
      await writeFile(path, content, "utf-8");
      tempFiles.push(path);

      const result = await parser.canParse(path);
      expect(result).toBe(false);
    });

    test("returns false for .jsonl files without session header", async () => {
      const content = JSON.stringify({ type: "other", data: "test" });
      const path = await createTempFile(content);

      const result = await parser.canParse(path);
      expect(result).toBe(false);
    });
  });

  describe("parse", () => {
    test("extracts session id, cwd, createdAt from header", async () => {
      const content = createSessionBuilder()
        .withHeader({
          id: "session-123",
          cwd: "/home/user/project",
          timestamp: "2026-01-15T10:30:00.000Z",
        })
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.id).toBe("session-123");
      expect(session.cwd).toBe("/home/user/project");
      expect(session.createdAt).toBe("2026-01-15T10:30:00.000Z");
      expect(session.source).toBe("pi");
    });

    test("extracts session name from session_info line", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withName("My Test Session")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.name).toBe("My Test Session");
    });

    test("parses user messages into turns with role user", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withUserMessage("Hello, assistant!")
        .withUserMessage("How are you?")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(2);
      expect(session.turns[0].role).toBe("user");
      expect(session.turns[0].textContent).toBe("Hello, assistant!");
      expect(session.turns[1].role).toBe("user");
      expect(session.turns[1].textContent).toBe("How are you?");
    });

    test("parses assistant messages, extracting text content and tool calls", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withAssistantMessage("I'll help you with that.")
        .withWriteToolCall("test.txt", "Hello world")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(2);

      expect(session.turns[0].role).toBe("assistant");
      expect(session.turns[0].textContent).toBe("I'll help you with that.");
      expect(session.turns[0].toolCalls).toHaveLength(0);

      expect(session.turns[1].role).toBe("assistant");
      expect(session.turns[1].toolCalls).toHaveLength(1);
      expect(session.turns[1].toolCalls[0].name).toBe("Write");
      expect(session.turns[1].toolCalls[0].args).toEqual({
        path: "test.txt",
        content: "Hello world",
      });
    });

    test("skips thinking blocks in assistant messages", async () => {
      const lines = [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "test",
          timestamp: new Date().toISOString(),
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              { type: "thinking", thinking: "Let me think about this..." },
              { type: "text", text: "Here's my response." },
            ],
          },
        }),
      ];
      const path = await createTempFile(lines.join("\n"));

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      expect(session.turns[0].textContent).toBe("Here's my response.");
      expect(session.turns[0].textContent).not.toContain("Let me think");
    });

    test("parses tool results as system turns", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withToolResult("Write", "File written successfully")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      expect(session.turns[0].role).toBe("system");
      expect(session.turns[0].textContent).toBe("File written successfully");
    });

    test("parses bash executions as system turns with $ command\\noutput format", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withBashExecution("ls -la", "total 8\ndrwxr-xr-x  2 user user 4096")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      expect(session.turns[0].role).toBe("system");
      expect(session.turns[0].textContent).toBe(
        "$ ls -la\ntotal 8\ndrwxr-xr-x  2 user user 4096",
      );
    });

    test("parses compaction summaries as system turns", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withCompactionSummary(
          "Previous conversation was about setting up tests",
        )
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      expect(session.turns[0].role).toBe("system");
      expect(session.turns[0].textContent).toBe(
        "Previous conversation was about setting up tests",
      );
    });

    test("skips model_change, thinking_level_change, custom lines", async () => {
      const lines = [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "test",
          timestamp: new Date().toISOString(),
        }),
        JSON.stringify({ type: "model_change" }),
        JSON.stringify({ type: "thinking_level_change" }),
        JSON.stringify({ type: "custom" }),
        JSON.stringify({
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Hello" }],
          },
        }),
      ];
      const path = await createTempFile(lines.join("\n"));

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      expect(session.turns[0].textContent).toBe("Hello");
    });

    test("handles sessions without a name (name should be undefined)", async () => {
      const content = createSessionBuilder()
        .withHeader()
        .withUserMessage("Test message")
        .build();
      const path = await createTempFile(content);

      const session = await parser.parse(path);

      expect(session.name).toBeUndefined();
    });
  });
});
