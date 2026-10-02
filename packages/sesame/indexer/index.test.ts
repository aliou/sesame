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
import {
  type Database,
  getSession,
  getSessionSkills,
  openDatabase,
  search,
} from "../storage/db";
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

    test("indexes current titles and checkpoints but excludes discovery results", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/metadata.jsonl",
        createSessionBuilder()
          .withHeader({ id: "metadata" })
          .withName("Searchable title", { id: "title-entry" })
          .withUserMessage("Checkpoint target", { id: "message-entry" })
          .withLabel("message-entry", "Searchable checkpoint")
          .withToolCall("find_sessions", { query: "Find session arguments" })
          .withToolResult("FIND_SESSIONS", "Secret discovery result")
          .withToolResult("Bash", "Other result remains searchable")
          .build(),
      );

      await indexFile(db, filePath);

      const chunks = db
        .prepare(
          "SELECT kind, content, source_type, entry_id FROM chunks WHERE session_id = ? ORDER BY seq",
        )
        .all("metadata") as Array<{
        kind: string;
        content: string;
        source_type: string | null;
        entry_id: string | null;
      }>;

      expect(chunks).toContainEqual({
        kind: "metadata",
        content: "session: Searchable title",
        source_type: "session_info",
        entry_id: "title-entry",
      });
      expect(chunks).toContainEqual({
        kind: "metadata",
        content: "checkpoint: Searchable checkpoint",
        source_type: "label",
        entry_id: "message-entry",
      });
      expect(chunks.map((chunk) => chunk.content).join("\n")).not.toContain(
        "Secret discovery result",
      );
      expect(chunks.map((chunk) => chunk.content).join("\n")).toContain(
        "Other result remains searchable",
      );
      expect(chunks.map((chunk) => chunk.content).join("\n")).toContain(
        "Find session arguments",
      );
    });
  });

  describe("codemode nested calls", () => {
    test("indexes nested calls as tool_call chunks with via and filterable args", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/codemode.jsonl",
        createSessionBuilder()
          .withHeader({ id: "codemode" })
          .withToolCall("codemode", {
            code: "await tools.read({path: '/x/README.md'})",
          })
          .withToolResult("codemode", "Script completed\nOutput:", {
            nestedCalls: {
              calls: [
                {
                  id: "ctc_1/1",
                  name: "read",
                  arguments: { path: "/x/README.md" },
                  status: "ok",
                },
                {
                  id: "ctc_1/2",
                  name: "bash",
                  arguments: { command: "make test" },
                  status: "error",
                },
              ],
              complete: true,
            },
          })
          .build(),
      );

      await indexFile(db, filePath);

      const chunks = db
        .prepare(
          "SELECT kind, tool_name, via, is_error, content FROM chunks WHERE session_id = ? AND kind = 'tool_call' ORDER BY seq",
        )
        .all("codemode") as Array<{
        kind: string;
        tool_name: string;
        via: string | null;
        is_error: number | null;
        content: string;
      }>;

      // The codemode call itself, then one chunk per nested call.
      expect(chunks).toHaveLength(3);
      expect(chunks[0].tool_name).toBe("codemode");
      expect(chunks[0].via).toBeNull();
      expect(chunks[0].content).toContain(
        "code:\nawait tools.read({path: '/x/README.md'})",
      );

      expect(chunks[1]).toMatchObject({
        tool_name: "read",
        via: "codemode",
        is_error: 0,
      });
      expect(chunks[1].content).toContain("via: codemode");
      expect(chunks[1].content).toContain("path: /x/README.md");

      expect(chunks[2]).toMatchObject({
        tool_name: "bash",
        via: "codemode",
        is_error: 1,
      });
      expect(chunks[2].content).toContain("status: error");

      const toolArgs = db
        .prepare(
          `SELECT ta.key, ta.value FROM tool_call_args ta
           JOIN chunks c ON c.id = ta.chunk_id
           WHERE c.session_id = ? AND c.tool_name = 'read'`,
        )
        .all("codemode") as Array<{ key: string; value: string }>;
      expect(toolArgs).toEqual([{ key: "path", value: "/x/README.md" }]);
    });

    test("via filter matches sessions with nested calls", async () => {
      addFile(
        "/tmp/sesame-sessions/nested.jsonl",
        createSessionBuilder()
          .withHeader({ id: "nested" })
          .withToolResult("codemode", "Script completed", {
            nestedCalls: {
              calls: [
                {
                  id: "ctc_1/1",
                  name: "read",
                  arguments: { path: "/x/AGENTS.md" },
                  status: "ok",
                },
              ],
              complete: true,
            },
          })
          .build(),
      );
      addFile(
        "/tmp/sesame-sessions/toplevel.jsonl",
        createSessionBuilder()
          .withHeader({ id: "toplevel" })
          .withToolCall("read", { path: "/x/AGENTS.md" })
          .build(),
      );

      await indexSessions(db, "/tmp/sesame-sessions");

      const viaResults = search(db, "AGENTS", { via: "codemode" });
      expect(viaResults.map((r) => r.sessionId)).toEqual(["nested"]);

      const toolResults = search(db, "AGENTS", {
        toolsOnly: true,
        toolName: "read",
      });
      expect(toolResults.map((r) => r.sessionId).sort()).toEqual([
        "nested",
        "toplevel",
      ]);

      const argResults = search(db, "*", {
        toolArgs: [{ tool: "read", key: "path", value: "AGENTS.md" }],
      });
      expect(argResults.map((r) => r.sessionId).sort()).toEqual([
        "nested",
        "toplevel",
      ]);
    });

    test("keeps assistant text that only invokes discovery tools", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/assistant-discovery.jsonl",
        createSessionBuilder()
          .withHeader({ id: "assistant-discovery" })
          .withAssistantMessage("Let me look up that session.")
          .withToolCall("find_sessions", { query: "database migrations" })
          .build(),
      );

      await indexFile(db, filePath);

      const contents = (
        db
          .prepare("SELECT content FROM chunks WHERE session_id = ?")
          .all("assistant-discovery") as Array<{ content: string }>
      ).map((chunk) => chunk.content);

      expect(contents.join("\n")).toContain("Let me look up that session.");
    });

    test("stores null is_error for unfinished nested calls", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/unfinished.jsonl",
        createSessionBuilder()
          .withHeader({ id: "unfinished" })
          .withToolResult("codemode", "Script failed", {
            isError: true,
            nestedCalls: {
              calls: [
                {
                  id: "ctc_1/1",
                  name: "bash",
                  arguments: { command: "sleep 99" },
                  status: "unfinished",
                },
              ],
              complete: false,
            },
          })
          .build(),
      );

      await indexFile(db, filePath);

      const chunk = db
        .prepare(
          "SELECT is_error FROM chunks WHERE session_id = ? AND kind = 'tool_call' AND tool_name = 'bash'",
        )
        .get("unfinished") as { is_error: number | null };
      expect(chunk.is_error).toBeNull();
    });

    test("suppresses codemode results that only wrap discovery tools", async () => {
      const filePath = addFile(
        "/tmp/sesame-sessions/discovery.jsonl",
        createSessionBuilder()
          .withHeader({ id: "discovery" })
          .withToolResult("codemode", "Secret nested discovery result", {
            nestedCalls: {
              calls: [
                {
                  id: "ctc_1/1",
                  name: "find_sessions",
                  arguments: { query: "database" },
                  status: "ok",
                },
              ],
              complete: true,
            },
          })
          .withToolResult("codemode", "Mixed result stays searchable", {
            nestedCalls: {
              calls: [
                {
                  id: "ctc_2/1",
                  name: "read_session",
                  arguments: { goal: "x" },
                  status: "ok",
                },
                {
                  id: "ctc_2/2",
                  name: "read",
                  arguments: { path: "/x/README.md" },
                  status: "ok",
                },
              ],
              complete: true,
            },
          })
          .build(),
      );

      await indexFile(db, filePath);

      const contents = (
        db
          .prepare("SELECT content FROM chunks WHERE session_id = ?")
          .all("discovery") as Array<{ content: string }>
      ).map((chunk) => chunk.content);

      expect(contents.join("\n")).not.toContain(
        "Secret nested discovery result",
      );
      expect(contents.join("\n")).toContain("Mixed result stays searchable");
    });
  });

  describe("skill indexing", () => {
    test("records injected skill invocations and SKILL.md reads", async () => {
      addFile(
        "/tmp/sesame-sessions/sess-skills.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-skills", cwd: "/project" })
          .withUserMessage("use the vitest skill")
          .withSkillInvocation("vitest", "/skills/vitest/SKILL.md")
          .withToolCall("Read", { path: "/other-skills/biome/SKILL.md" })
          .withToolCall("Read", { path: "/other-skills/biome/reference.md" })
          .build(),
      );

      await indexSessions(db, "/tmp/sesame-sessions");

      expect(getSessionSkills(db, "sess-skills")).toEqual([
        {
          session_id: "sess-skills",
          name: "biome",
          path: "/other-skills/biome/SKILL.md",
          actor: "agent",
          detail: null,
        },
        {
          session_id: "sess-skills",
          name: "vitest",
          path: "/skills/vitest/SKILL.md",
          actor: "user",
          detail: "autocomplete",
        },
      ]);

      expect(
        search(db, "*", { skill: "biome" }).map((r) => r.sessionId),
      ).toEqual(["sess-skills"]);
      expect(
        search(db, "*", { skillPath: "/skills/vitest/" }).map(
          (r) => r.sessionId,
        ),
      ).toEqual(["sess-skills"]);
    });

    test("re-indexing replaces skills instead of duplicating them", async () => {
      const path = addFile(
        "/tmp/sesame-sessions/sess-reindex.jsonl",
        createSessionBuilder()
          .withHeader({ id: "sess-reindex", cwd: "/project" })
          .withSkillInvocation("vitest", "/skills/vitest/SKILL.md")
          .build(),
      );

      await indexSessions(db, "/tmp/sesame-sessions");
      touch(path);
      await indexSessions(db, "/tmp/sesame-sessions");

      expect(getSessionSkills(db, "sess-reindex")).toHaveLength(1);
    });
  });
});
