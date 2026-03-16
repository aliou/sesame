import * as sesameModule from "@aliou/sesame";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import searchCommand from "./search-cmd";

vi.mock("@aliou/sesame", () => ({
  getXDGPaths: vi.fn(() => ({
    data: "/tmp/sesame-test-data",
    config: "/tmp/sesame-test-config",
    cache: "/tmp/sesame-test-cache",
  })),
  loadConfig: vi.fn(async () => {}),
  openDatabase: vi.fn(() => ({
    close: vi.fn(),
  })),
  parseRelativeDate: vi.fn((value: string) => value),
  search: vi.fn(() => []),
}));

describe("search command", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.clearAllMocks();
  });

  test("parses repeatable --exclude flag", async () => {
    await searchCommand(["query", "--exclude", "session-1", "--exclude", "session-2", "--json"]);

    expect(sesameModule.search).toHaveBeenCalledWith(
      expect.anything(),
      "query",
      expect.objectContaining({
        exclude: ["session-1", "session-2"],
      }),
    );
  });
});
