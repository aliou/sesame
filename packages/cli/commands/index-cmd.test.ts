import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { runCli } from "../run";
import {
  captureOutput,
  cliArgv,
  createSesameSandbox,
  type SesameSandbox,
} from "../testing/cli";

const mocks = vi.hoisted(() => ({
  acquireIndexLock: vi.fn(),
  indexSessions: vi.fn(),
}));

vi.mock(import("@aliou/sesame"), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    acquireIndexLock: mocks.acquireIndexLock,
    indexSessions: mocks.indexSessions,
  };
});

const release = vi.fn();
let sandbox: SesameSandbox;

async function run(...args: string[]) {
  const io = captureOutput();
  try {
    const code = await runCli(cliArgv(...args));
    return { code, stdout: io.stdout(), stderr: io.stderr() };
  } finally {
    io.restore();
  }
}

describe("sesame index", () => {
  beforeEach(() => {
    sandbox = createSesameSandbox();
    mocks.acquireIndexLock.mockReturnValue({ path: "index.lock", release });
    mocks.indexSessions.mockResolvedValue({
      added: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    });
  });

  afterEach(() => {
    sandbox.cleanup();
  });

  test("acquires and releases the lock", async () => {
    const result = await run("index");
    expect(result.code).toBe(0);
    expect(mocks.acquireIndexLock).toHaveBeenCalledWith(
      process.env.SESAME_DATA_DIR,
      "index",
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("releases the lock when indexing throws", async () => {
    mocks.indexSessions.mockRejectedValueOnce(new Error("boom"));
    const result = await run("index");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("SESAME_ERROR: boom");
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("a held lock fails with INDEX_LOCKED", async () => {
    mocks.acquireIndexLock.mockImplementationOnce(() => {
      throw new Error("Index already running (watch pid=123)");
    });
    const result = await run("index", "-o", "json");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stderr).error.code).toBe("INDEX_LOCKED");
    expect(mocks.indexSessions).not.toHaveBeenCalled();
  });

  test("file errors finish with exit code 3", async () => {
    mocks.indexSessions.mockResolvedValueOnce({
      added: 1,
      updated: 0,
      skipped: 0,
      errors: 2,
    });
    const result = await run("index", "-o", "json");
    expect(result.code).toBe(3);
    expect(JSON.parse(result.stdout).totals.errors).toBe(2);
    expect(result.stderr).toContain("2 session files failed to index");
  });
});
