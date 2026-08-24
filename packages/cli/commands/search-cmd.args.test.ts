import * as sesameModule from "@aliou/sesame";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import searchCommand from "./search-cmd";

vi.mock("@aliou/sesame", () => ({
  getXDGPaths: vi.fn(() => ({
    data: "/tmp/sesame-test-data",
    config: "/tmp/sesame-test-config",
    cache: "/tmp/sesame-test-cache",
  })),
  getSkillsForSessions: vi.fn(() => new Map()),
  loadConfig: vi.fn(async () => {}),
  openDatabase: vi.fn(() => ({ close: vi.fn() })),
  parseRelativeDate: vi.fn((value: string) => value),
  search: vi.fn(() => []),
  skillNameExists: vi.fn(() => false),
  TOOL_ARG_ALLOWLIST: {},
}));

describe("search command argument validation", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.clearAllMocks();
  });

  test("rejects unknown flags", async () => {
    await expect(searchCommand(["query", "--bogus"])).rejects.toThrow(
      "Unknown option: --bogus",
    );
  });

  test("rejects unknown short flags", async () => {
    await expect(searchCommand(["-x"])).rejects.toThrow("Unknown option: -x");
  });

  test("throws when a value flag is missing at end of argv", async () => {
    await expect(searchCommand(["query", "--limit"])).rejects.toThrow(
      "--limit requires a value",
    );
  });

  test("throws when --cwd value is missing", async () => {
    await expect(searchCommand(["--cwd"])).rejects.toThrow(
      "--cwd requires a value",
    );
  });

  test("throws when --after value is missing", async () => {
    await expect(searchCommand(["--after"])).rejects.toThrow(
      "--after requires a value",
    );
  });

  test("throws when --exclude value is missing", async () => {
    await expect(searchCommand(["--exclude"])).rejects.toThrow(
      "--exclude requires a value",
    );
  });

  test("throws when --limit is not a positive integer", async () => {
    await expect(searchCommand(["--limit", "abc"])).rejects.toThrow(
      "--limit must be a positive integer",
    );
  });

  test("throws when --limit is zero", async () => {
    await expect(searchCommand(["--limit", "0"])).rejects.toThrow(
      "--limit must be a positive integer",
    );
  });

  test("throws when --limit is negative", async () => {
    await expect(searchCommand(["--limit", "-5"])).rejects.toThrow(
      "--limit must be a positive integer",
    );
  });

  test("accepts a valid positive --limit", async () => {
    await searchCommand(["query", "--limit", "5", "--json"]);
    // No throw == pass. search was called with limit 5.
    expect(sesameModule.search).toHaveBeenCalledWith(
      expect.anything(),
      "query",
      expect.objectContaining({ limit: 5 }),
    );
  });
});
