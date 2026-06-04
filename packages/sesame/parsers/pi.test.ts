import { vol } from "memfs";
import { assert, beforeEach, describe, expect, test, vi } from "vitest";
import { createSessionBuilder } from "../test-helpers/session-factory";
import { PiParser } from "./pi";

vi.mock("node:fs");
vi.mock("node:fs/promises");

describe("PiParser", () => {
  const parser = new PiParser();
  let fileId = 0;

  beforeEach(() => {
    vol.reset();
    fileId = 0;
  });

  function addSessionFile(content: string, extension = "jsonl"): string {
    const path = `/tmp/sesame-parser/session-${fileId++}.${extension}`;
    vol.fromJSON({ [path]: content });
    return path;
  }

  describe("canParse", () => {
    test("returns true for .jsonl files with valid session header", async () => {
      const path = addSessionFile(createSessionBuilder().withHeader().build());

      await expect(parser.canParse(path)).resolves.toBe(true);
    });

    test("returns false for non-.jsonl files", async () => {
      const path = addSessionFile(
        createSessionBuilder().withHeader().build(),
        "txt",
      );

      await expect(parser.canParse(path)).resolves.toBe(false);
    });

    test("returns false for .jsonl files without session header", async () => {
      const path = addSessionFile(
        JSON.stringify({ type: "other", data: "test" }),
      );

      await expect(parser.canParse(path)).resolves.toBe(false);
    });

    test("returns true for large .jsonl files", async () => {
      const header = JSON.stringify({
        type: "session",
        version: 3,
        id: "big-session",
        timestamp: new Date().toISOString(),
      });
      const lines = [header];
      for (let i = 0; i < 5000; i++) {
        lines.push(
          JSON.stringify({
            type: "message",
            message: { role: "user", content: `${"x".repeat(100)}` },
          }),
        );
      }
      const path = addSessionFile(lines.join("\n"));

      await expect(parser.canParse(path)).resolves.toBe(true);
    });
  });

  describe("parse", () => {
    test("extracts session id, cwd, createdAt from header", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader({
            id: "session-123",
            cwd: "/home/user/project",
            timestamp: "2026-01-15T10:30:00.000Z",
          })
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.id).toBe("session-123");
      expect(session.cwd).toBe("/home/user/project");
      expect(session.createdAt).toBe("2026-01-15T10:30:00.000Z");
      expect(session.source).toBe("pi");
    });

    test("extracts session name from session_info line", async () => {
      const path = addSessionFile(
        createSessionBuilder().withHeader().withName("My Test Session").build(),
      );

      const session = await parser.parse(path);

      expect(session.name).toBe("My Test Session");
    });

    test("parses user messages into turns with role user", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withUserMessage("Hello, assistant!")
          .withUserMessage("How are you?")
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(2);
      const firstTurn = session.turns[0];
      const secondTurn = session.turns[1];
      assert(firstTurn, "first turn should exist");
      assert(secondTurn, "second turn should exist");
      expect(firstTurn.role).toBe("user");
      expect(firstTurn.textContent).toBe("Hello, assistant!");
      expect(secondTurn.role).toBe("user");
      expect(secondTurn.textContent).toBe("How are you?");
    });

    test("parses assistant messages, extracting text content and tool calls", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withAssistantMessage("I'll help you with that.")
          .withWriteToolCall("test.txt", "Hello world")
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(2);
      const firstTurn = session.turns[0];
      const secondTurn = session.turns[1];
      assert(firstTurn, "first turn should exist");
      assert(secondTurn, "second turn should exist");

      expect(firstTurn.role).toBe("assistant");
      expect(firstTurn.textContent).toBe("I'll help you with that.");
      expect(firstTurn.toolCalls).toHaveLength(0);

      expect(secondTurn.role).toBe("assistant");
      expect(secondTurn.toolCalls).toHaveLength(1);
      const toolCall = secondTurn.toolCalls[0];
      assert(toolCall, "tool call should exist");
      expect(toolCall.name).toBe("Write");
      expect(toolCall.args).toEqual({
        path: "test.txt",
        content: "Hello world",
      });
    });

    test("skips thinking blocks in assistant messages", async () => {
      const path = addSessionFile(
        [
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
        ].join("\n"),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.textContent).toBe("Here's my response.");
      expect(turn.textContent).not.toContain("Let me think");
    });

    test("parses tool results as system turns", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withToolResult("Write", "File written successfully")
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.role).toBe("system");
      expect(turn.textContent).toBe("File written successfully");
      expect(turn.toolName).toBe("Write");
      expect(turn.isError).toBe(false);
    });

    test("parses tool results with isError flag", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withToolResult("Bash", "Command failed with exit code 1", {
            isError: true,
          })
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.role).toBe("system");
      expect(turn.toolName).toBe("Bash");
      expect(turn.isError).toBe(true);
    });

    test("parses bash executions as system turns", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withBashExecution("ls -la", "total 8\ndrwxr-xr-x  2 user user 4096")
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.role).toBe("system");
      expect(turn.textContent).toBe(
        "$ ls -la\ntotal 8\ndrwxr-xr-x  2 user user 4096",
      );
    });

    test("parses compaction summaries as system turns", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withCompactionSummary(
            "Previous conversation was about setting up tests",
          )
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.role).toBe("system");
      expect(turn.textContent).toBe(
        "Previous conversation was about setting up tests",
      );
    });

    test("skips model_change, thinking_level_change, custom lines", async () => {
      const path = addSessionFile(
        [
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
        ].join("\n"),
      );

      const session = await parser.parse(path);

      expect(session.turns).toHaveLength(1);
      const turn = session.turns[0];
      assert(turn, "turn should exist");
      expect(turn.textContent).toBe("Hello");
    });

    test("handles sessions without a name", async () => {
      const path = addSessionFile(
        createSessionBuilder()
          .withHeader()
          .withUserMessage("Test message")
          .build(),
      );

      const session = await parser.parse(path);

      expect(session.name).toBeUndefined();
    });
  });
});
