import { fs, vol } from "memfs";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { type Database, getSession, openDatabase } from "../storage/db";
import { createSessionBuilder } from "../test-helpers/session-factory";
import { indexFile, indexSessions } from "./index";

vi.mock("node:fs");
vi.mock("node:fs/promises");

describe("indexer", () => {
  let db: Database;

  beforeEach(() => {
    vol.reset();
    fs.mkdirSync("/tmp/sesame-sessions", { recursive: true });
    db = openDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
    vol.reset();
  });

  function addFile(path: string, content: string): string {
    fs.writeFileSync(path, content, "utf8");
    return path;
  }

  function touch(path: string, date = new Date(Date.now() + 1000)): void {
    fs.utimesSync(path, date, date);
  }

  describe("indexSessions", () => {
    test("indexes a valid session file", async () => {
      addFile(
        "/tmp/sesame-sessions/sess-1.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-1", cwd: "/project" })
          .withUserMessage("Hello")
          .build(),
      );

      const result = await indexSessions(db, "/tmp/sesame-sessions");

      expect(result.added).toBe(1);
      expect(result.errors).toBe(0);

      const session = getSession(db, "sess-1");
      assert(session, "session should exist");
      expect(session.id).toBe("sess-1");
      expect(session.cwd).toBe("/project");
    });

    test("skips non-.jsonl files", async () => {
      addFile("/tmp/sesame-sessions/readme.txt", "not a session");
      addFile("/tmp/sesame-sessions/data.json", '{"type":"session"}');

      const result = await indexSessions(db, "/tmp/sesame-sessions");

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test("skips .jsonl files without session header", async () => {
      addFile(
        "/tmp/sesame-sessions/other.jsonl",
        JSON.stringify({ type: "other", data: "test" }),
      );

      const result = await indexSessions(db, "/tmp/sesame-sessions");

      expect(result.added).toBe(0);
    });

    test("skips unchanged files on second index", async () => {
      addFile(
        "/tmp/sesame-sessions/sess-2.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-2" })
          .withUserMessage("Hello")
          .build(),
      );

      const first = await indexSessions(db, "/tmp/sesame-sessions");
      expect(first.added).toBe(1);

      const second = await indexSessions(db, "/tmp/sesame-sessions");
      expect(second.skipped).toBe(1);
      expect(second.added).toBe(0);
    });

    test("updates a session when file mtime changes", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/sess-3.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-3" })
          .withUserMessage("Hello")
          .build(),
      );

      const first = await indexSessions(db, "/tmp/sesame-sessions");
      expect(first.added).toBe(1);

      addFile(
        filePath,
        createSessionBuilder()
          .withHeader({ id: "sess-3" })
          .withUserMessage("Hello")
          .withAssistantMessage("Updated response")
          .build(),
      );
      touch(filePath);

      const second = await indexSessions(db, "/tmp/sesame-sessions");
      expect(second.updated).toBe(1);
    });

    test("scans one level of subdirectories", async () => {
      fs.mkdirSync("/tmp/sesame-sessions/encoded-cwd", { recursive: true });
      addFile(
        "/tmp/sesame-sessions/encoded-cwd/sess-4.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-4" })
          .withUserMessage("In subdir")
          .build(),
      );

      const result = await indexSessions(db, "/tmp/sesame-sessions");

      expect(result.added).toBe(1);
      expect(getSession(db, "sess-4")).not.toBeNull();
    });

    test("returns errors for unreadable directories", async () => {
      const result = await indexSessions(db, "/tmp/missing");

      expect(result.added).toBe(0);
      expect(result.errors).toBe(0);
    });

    test("handles large files efficiently", async () => {
      const lines = [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "large-sess",
          timestamp: new Date().toISOString(),
        }),
      ];
      for (let i = 0; i < 10000; i++) {
        lines.push(
          JSON.stringify({
            type: "message",
            message: {
              role: "user",
              content: `Line ${i}: ${"x".repeat(100)}`,
            },
          }),
        );
      }
      addFile("/tmp/sesame-sessions/large-sess.jsonl", lines.join("\n"));

      const result = await indexSessions(db, "/tmp/sesame-sessions");

      expect(result.added).toBe(1);
      const session = getSession(db, "large-sess");
      assert(session, "large session should exist");
      expect(session.message_count).toBeGreaterThan(0);
    });
  });

  describe("indexFile", () => {
    test("indexes a single valid file", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/single-1.jsonl",
        createSessionBuilder()
          .withHeader({ id: "single-1", cwd: "/project" })
          .withUserMessage("Single file test")
          .build(),
      );

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(1);
      expect(result.errors).toBe(0);

      const session = getSession(db, "single-1");
      assert(session, "session should exist");
      expect(session.id).toBe("single-1");
      expect(session.cwd).toBe("/project");
    });

    test("skips non-.jsonl file", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/readme.txt",
        "not a session",
      );

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.updated).toBe(0);
    });

    test("skips .jsonl without session header", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/other.jsonl",
        JSON.stringify({ type: "other" }),
      );

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test("skips unchanged file on second call", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/single-2.jsonl",
        createSessionBuilder()
          .withHeader({ id: "single-2" })
          .withUserMessage("Hello")
          .build(),
      );

      const first = await indexFile(db, filePath);
      expect(first.added).toBe(1);

      const second = await indexFile(db, filePath);
      expect(second.skipped).toBe(1);
      expect(second.added).toBe(0);
    });

    test("updates file when mtime changes", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/single-3.jsonl",
        createSessionBuilder()
          .withHeader({ id: "single-3" })
          .withUserMessage("Hello")
          .build(),
      );

      const first = await indexFile(db, filePath);
      expect(first.added).toBe(1);

      addFile(
        filePath,
        createSessionBuilder()
          .withHeader({ id: "single-3" })
          .withUserMessage("Hello")
          .withAssistantMessage("New response")
          .build(),
      );
      touch(filePath);

      const second = await indexFile(db, filePath);
      expect(second.updated).toBe(1);
    });

    test("does not scan the entire directory", async () => {
      const targetPath = addFile(
        "/tmp/sesame-sessions/target.jsonl",
        createSessionBuilder()
          .withHeader({ id: "target-sess" })
          .withUserMessage("Target")
          .build(),
      );
      addFile(
        "/tmp/sesame-sessions/other.jsonl",
        createSessionBuilder()
          .withHeader({ id: "other-sess" })
          .withUserMessage("Other")
          .build(),
      );

      const result = await indexFile(db, targetPath);

      expect(result.added).toBe(1);
      expect(getSession(db, "target-sess")).not.toBeNull();
      expect(getSession(db, "other-sess")).toBeNull();
    });
  });
});
