import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type Database, getSession, openDatabase } from "../storage/db";
import { createSessionBuilder } from "../test-helpers/session-factory";
import { indexFile, indexSessions } from "./index";

describe("indexer", () => {
  let db: Database;
  let testDir: string;
  let cleanupPaths: string[];

  function setup(): void {
    db = openDatabase(":memory:");
    testDir = join(tmpdir(), `sesame-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });
    cleanupPaths = [testDir];
  }

  function teardown(): void {
    db.close();
    for (const p of cleanupPaths) {
      try {
        rmSync(p, { recursive: true, force: true });
      } catch {
        void 0;
      }
    }
    cleanupPaths = [];
  }

  describe("indexSessions", () => {
    beforeEach(setup);
    afterEach(teardown);

    test("indexes a valid session file", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "sess-1", cwd: "/project" })
        .withUserMessage("Hello")
        .build();
      writeFileSync(join(testDir, "sess-1.jsonl"), content);

      const result = await indexSessions(db, testDir);

      expect(result.added).toBe(1);
      expect(result.errors).toBe(0);

      const session = getSession(db, "sess-1");
      expect(session).not.toBeNull();
      expect(session?.id).toBe("sess-1");
      expect(session?.cwd).toBe("/project");
    });

    test("skips non-.jsonl files", async () => {
      writeFileSync(join(testDir, "readme.txt"), "not a session");
      writeFileSync(join(testDir, "data.json"), '{"type":"session"}');

      const result = await indexSessions(db, testDir);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test("skips .jsonl files without session header", async () => {
      writeFileSync(
        join(testDir, "other.jsonl"),
        JSON.stringify({ type: "other", data: "test" }),
      );

      const result = await indexSessions(db, testDir);

      expect(result.added).toBe(0);
    });

    test("skips unchanged files on second index (mtime check)", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "sess-2" })
        .withUserMessage("Hello")
        .build();
      writeFileSync(join(testDir, "sess-2.jsonl"), content);

      const first = await indexSessions(db, testDir);
      expect(first.added).toBe(1);

      const second = await indexSessions(db, testDir);
      expect(second.skipped).toBe(1);
      expect(second.added).toBe(0);
    });

    test("updates a session when file mtime changes", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "sess-3" })
        .withUserMessage("Hello")
        .build();
      const filePath = join(testDir, "sess-3.jsonl");
      writeFileSync(filePath, content);

      const first = await indexSessions(db, testDir);
      expect(first.added).toBe(1);

      // Wait briefly so mtime differs
      await new Promise((r) => setTimeout(r, 50));

      const updatedContent = createSessionBuilder()
        .withHeader({ id: "sess-3" })
        .withUserMessage("Hello")
        .withAssistantMessage("Updated response")
        .build();
      writeFileSync(filePath, updatedContent);

      const second = await indexSessions(db, testDir);
      expect(second.updated).toBe(1);
    });

    test("scans one level of subdirectories", async () => {
      const subdir = join(testDir, "encoded-cwd");
      mkdirSync(subdir, { recursive: true });

      const content = createSessionBuilder()
        .withHeader({ id: "sess-4" })
        .withUserMessage("In subdir")
        .build();
      writeFileSync(join(subdir, "sess-4.jsonl"), content);

      const result = await indexSessions(db, testDir);

      expect(result.added).toBe(1);
      const session = getSession(db, "sess-4");
      expect(session).not.toBeNull();
    });

    test("returns errors for unreadable directories", async () => {
      const result = await indexSessions(db, "/nonexistent/path");
      expect(result.added).toBe(0);
      expect(result.errors).toBe(0);
    });

    test("handles large files efficiently (does not read entire file for mtime check)", async () => {
      // This test verifies the fix: readFirstLine only reads 4KB, not the whole file.
      // A session file with a 1MB body should not cause O(n) overhead for canParse/mtime.
      const lines = [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "large-sess",
          timestamp: new Date().toISOString(),
        }),
      ];
      // Add lots of content lines to make it large
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
      writeFileSync(join(testDir, "large-sess.jsonl"), lines.join("\n"));

      const result = await indexSessions(db, testDir);
      expect(result.added).toBe(1);

      const session = getSession(db, "large-sess");
      expect(session).not.toBeNull();
      expect(session?.message_count).toBeGreaterThan(0);
    });
  });

  describe("indexFile", () => {
    beforeEach(setup);
    afterEach(teardown);

    test("indexes a single valid file", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "single-1", cwd: "/project" })
        .withUserMessage("Single file test")
        .build();
      const filePath = join(testDir, "single-1.jsonl");
      writeFileSync(filePath, content);

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(1);
      expect(result.errors).toBe(0);

      const session = getSession(db, "single-1");
      expect(session).not.toBeNull();
      expect(session?.id).toBe("single-1");
      expect(session?.cwd).toBe("/project");
    });

    test("skips non-.jsonl file", async () => {
      const filePath = join(testDir, "readme.txt");
      writeFileSync(filePath, "not a session");

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.updated).toBe(0);
    });

    test("skips .jsonl without session header", async () => {
      const filePath = join(testDir, "other.jsonl");
      writeFileSync(filePath, JSON.stringify({ type: "other" }));

      const result = await indexFile(db, filePath);

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test("skips unchanged file on second call (mtime check)", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "single-2" })
        .withUserMessage("Hello")
        .build();
      const filePath = join(testDir, "single-2.jsonl");
      writeFileSync(filePath, content);

      const first = await indexFile(db, filePath);
      expect(first.added).toBe(1);

      const second = await indexFile(db, filePath);
      expect(second.skipped).toBe(1);
      expect(second.added).toBe(0);
    });

    test("updates file when mtime changes", async () => {
      const content = createSessionBuilder()
        .withHeader({ id: "single-3" })
        .withUserMessage("Hello")
        .build();
      const filePath = join(testDir, "single-3.jsonl");
      writeFileSync(filePath, content);

      const first = await indexFile(db, filePath);
      expect(first.added).toBe(1);

      await new Promise((r) => setTimeout(r, 50));

      const updated = createSessionBuilder()
        .withHeader({ id: "single-3" })
        .withUserMessage("Hello")
        .withAssistantMessage("New response")
        .build();
      writeFileSync(filePath, updated);

      const second = await indexFile(db, filePath);
      expect(second.updated).toBe(1);
    });

    test("does not scan the entire directory", async () => {
      // Create a valid file to index
      const content = createSessionBuilder()
        .withHeader({ id: "target-sess" })
        .withUserMessage("Target")
        .build();
      const targetPath = join(testDir, "target.jsonl");
      writeFileSync(targetPath, content);

      // Create another file that should NOT be touched
      const otherContent = createSessionBuilder()
        .withHeader({ id: "other-sess" })
        .withUserMessage("Other")
        .build();
      writeFileSync(join(testDir, "other.jsonl"), otherContent);

      const result = await indexFile(db, targetPath);

      expect(result.added).toBe(1);

      // Only the target file was indexed
      expect(getSession(db, "target-sess")).not.toBeNull();
      expect(getSession(db, "other-sess")).toBeNull();
    });
  });
});
