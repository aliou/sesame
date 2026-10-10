import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createSessionBuilder } from "../sesame/test-helpers/session-factory";
import { runCli } from "./run";
import {
  captureOutput,
  cliArgv,
  createSesameSandbox,
  type SesameSandbox,
} from "./testing/cli";
import { VERSION } from "./version";

async function run(...args: string[]) {
  const io = captureOutput();
  try {
    const code = await runCli(cliArgv(...args));
    return { code, stdout: io.stdout(), stderr: io.stderr() };
  } finally {
    io.restore();
  }
}

function errorCode(stderr: string): string {
  return JSON.parse(stderr).error.code;
}

let sandbox: SesameSandbox;

beforeEach(() => {
  sandbox = createSesameSandbox();
});

afterEach(() => {
  sandbox.cleanup();
});

describe("help and version", () => {
  test.each([[], ["--help"], ["-h"], ["help"]])(
    "%j prints global help to stdout",
    async (...args) => {
      const result = await run(...args);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Available Commands:");
      for (const name of ["search", "skills", "index", "status", "watch"]) {
        expect(result.stdout).toContain(name);
      }
    },
  );

  test("command --help prints command flags", async () => {
    const result = await run("search", "--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("sesame search [query]");
    expect(result.stdout).toContain("--skill-path");
  });

  test.each([["--version"], ["-v"], ["search", "--version"]])(
    "%j prints the version",
    async (...args) => {
      const result = await run(...args);
      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(VERSION);
    },
  );

  test("-V is no longer a version alias", async () => {
    const result = await run("-V");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("INVALID_INPUT");
  });

  test.each(["config", "json", "exit-codes", "completion", "agent-guide"])(
    "help %s prints the topic",
    async (topic) => {
      const result = await run("help", topic);
      expect(result.code).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(0);
    },
  );
});

describe("usage errors exit 2", () => {
  test("unknown command", async () => {
    const result = await run("bogus");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("UNKNOWN_COMMAND: unknown command: bogus");
    expect(result.stdout).toBe("");
  });

  test.each([["-o", "json"], ["--output=json"], ["--json"], ["-j"]])(
    "JSON error envelope on stderr with %j",
    async (...flags) => {
      const result = await run("bogus", ...flags);
      expect(result.code).toBe(2);
      expect(errorCode(result.stderr)).toBe("UNKNOWN_COMMAND");
      expect(result.stdout).toBe("");
    },
  );

  test("unquoted multi-word query", async () => {
    const result = await run("search", "two", "words");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("quote arguments that contain spaces");
  });

  test.each([
    [["search", "--limit", "0"], "INVALID_INPUT"],
    [["search", "--limit", "abc"], "INVALID_INPUT"],
    [["search", "--bogus"], "INVALID_INPUT"],
    [["search", "--after", "yesterday"], "INVALID_DATE"],
    [["search", "--arg", "bash"], "INVALID_INPUT"],
    [["search", "--arg", "nope:x=y"], "INVALID_INPUT"],
    [["search", "--arg", "bash:nope=y"], "INVALID_INPUT"],
    [["skills", "--actor", "robot"], "INVALID_INPUT"],
    [["index", "extra"], "INVALID_INPUT"],
    [["completion", "tcsh"], "INVALID_INPUT"],
  ])("%j -> %s", async (args, code) => {
    const result = await run(...args, "-o", "json");
    expect(result.code).toBe(2);
    expect(errorCode(result.stderr)).toBe(code);
  });
});

test.each([
  ["status", "-o", "yaml"],
  ["-o", "yaml", "status"],
  ["--output=yaml", "help", "json"],
])("invalid --output value in %j exits 2", async (...args) => {
  const result = await run(...args);
  expect(result.code).toBe(2);
  expect(result.stderr).toContain('--output must be "human" or "json"');
  expect(result.stdout).toBe("");
});

describe("commands against a real index", () => {
  beforeEach(() => {
    sandbox.writeSession(
      "a.jsonl",
      createSessionBuilder()
        .withHeader({ id: "session-a", cwd: "/work/alpha" })
        .withName("Deploy pipeline")
        .withUserMessage("fix the deploy pipeline for staging")
        .withToolCall("bash", { command: "pnpm deploy --env staging" })
        .build(),
    );
    sandbox.writeSession(
      "b.jsonl",
      createSessionBuilder()
        .withHeader({ id: "session-b", cwd: "/work/beta" })
        .withUserMessage("deploy the docs site")
        .build(),
    );
  });

  test("index reports totals as JSON", async () => {
    const result = await run("index", "-o", "json");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).totals).toEqual({
      added: 2,
      updated: 0,
      skipped: 0,
      errors: 0,
    });
  });

  test("index progress goes to stderr, summary to stdout", async () => {
    const result = await run("index");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("ADDED");
    expect(result.stdout).not.toContain("Indexing");
    expect(result.stderr).toContain("Indexing");
  });

  test("search finds sessions, with globals before or after the command", async () => {
    await run("index");
    for (const args of [
      ["search", "deploy", "-o", "json"],
      ["-o", "json", "search", "deploy"],
      ["--compact", "search", "deploy", "--json"],
    ]) {
      const result = await run(...args);
      expect(result.code, args.join(" ")).toBe(0);
      expect(JSON.parse(result.stdout).resultCount).toBe(2);
    }
  });

  test("a command boolean flag does not swallow a following global flag", async () => {
    await run("index");
    const result = await run("search", "deploy", "--tools", "--json");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).results[0].sessionId).toBe("session-a");
  });

  test("--exclude repeats, in both spellings", async () => {
    await run("index");
    const result = await run(
      "search",
      "*",
      "--exclude",
      "session-a",
      "--exclude=session-b",
      "-o",
      "json",
    );
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).resultCount).toBe(0);
  });

  test("--arg filters on tool parameters", async () => {
    await run("index");
    const result = await run(
      "search",
      "--arg",
      "bash:command=staging",
      "-o",
      "json",
    );
    expect(result.code).toBe(0);
    const ids = JSON.parse(result.stdout).results.map(
      (row: { sessionId: string }) => row.sessionId,
    );
    expect(ids).toEqual(["session-a"]);
  });

  test("human search output", async () => {
    await run("index");
    const result = await run("search", "staging", "--no-color");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("session-a (Deploy pipeline)");
  });

  test("empty index prints a hint on stderr", async () => {
    const result = await run("search", "deploy", "-o", "json");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).resultCount).toBe(0);
    expect(result.stderr).toContain("sesame index");
  });

  test("status reports counts", async () => {
    await run("index");
    const json = await run("status", "-o", "json");
    expect(JSON.parse(json.stdout)).toMatchObject({
      sessionCount: 2,
      databasePath: expect.stringContaining("index.sqlite"),
    });
    const human = await run("status");
    expect(human.stdout).toMatch(/SESSIONS\s+2/);
  });

  test("skills returns JSON", async () => {
    await run("index");
    const result = await run("skills", "-o", "json");
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ skillCount: 0, skills: [] });
  });

  test("--debug writes paths to stderr only", async () => {
    const result = await run("status", "--debug", "-o", "json");
    expect(result.stderr).toContain(`data=${process.env.SESAME_DATA_DIR}`);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  });
});

describe("completion", () => {
  test("prints a shell script", async () => {
    const result = await run("completion", "zsh");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("sesame");
  });

  test("completes commands", async () => {
    const result = await run("complete", "--", "se");
    expect(result.stdout).toContain("search");
  });
});
