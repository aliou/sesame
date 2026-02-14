import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as dbModule from "../storage/db";
import searchCommand from "./search-cmd";

vi.mock("../storage/db", () => ({
  openDatabase: vi.fn(() => ({
    close: vi.fn(),
  })),
  search: vi.fn(() => []),
}));

vi.mock("../utils/config", () => ({
  loadConfig: vi.fn(async () => {}),
}));

vi.mock("../utils/xdg", () => ({
  getXDGPaths: vi.fn(() => ({
    data: "/tmp/sesame-test-data",
    config: "/tmp/sesame-test-config",
    cache: "/tmp/sesame-test-cache",
  })),
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
    await searchCommand([
      "query",
      "--exclude",
      "session-1",
      "--exclude",
      "session-2",
      "--json",
    ]);

    expect(dbModule.search).toHaveBeenCalledWith(
      expect.anything(),
      "query",
      expect.objectContaining({
        exclude: ["session-1", "session-2"],
      }),
    );
  });
});
