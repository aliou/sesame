import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import indexCommand from "./index-cmd";

const mockIndexSessions = vi.fn();
const mockDropAll = vi.fn();
const mockOpenDatabase = vi.fn();
const mockSetMetadata = vi.fn();
const mockLoadConfig = vi.fn();
const mockGetXDGPaths = vi.fn();
const mockAcquireIndexLock = vi.fn();

vi.mock("@aliou/sesame", () => ({
  PiParser: class {},
  acquireIndexLock: (...args: unknown[]) => mockAcquireIndexLock(...args),
  dropAll: (...args: unknown[]) => mockDropAll(...args),
  expandPath: (path: string) => path,
  getXDGPaths: (...args: unknown[]) => mockGetXDGPaths(...args),
  indexSessions: (...args: unknown[]) => mockIndexSessions(...args),
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  openDatabase: (...args: unknown[]) => mockOpenDatabase(...args),
  setMetadata: (...args: unknown[]) => mockSetMetadata(...args),
}));

describe("index command lock behavior", () => {
  const db = { close: vi.fn() };
  const release = vi.fn();
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockGetXDGPaths.mockReturnValue({
      data: "/tmp/sesame-test-data",
      config: "/tmp/sesame-test-config",
      cache: "/tmp/sesame-test-cache",
    });
    mockLoadConfig.mockResolvedValue({
      piSessionPaths: ["/tmp/sessions"],
    });
    mockOpenDatabase.mockReturnValue(db);
    mockAcquireIndexLock.mockReturnValue({
      path: "/tmp/sesame-test-data/index.lock",
      release,
    });
    mockIndexSessions.mockResolvedValue({
      added: 1,
      updated: 0,
      skipped: 0,
      errors: 0,
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    vi.clearAllMocks();
  });

  test("acquires and releases lock around indexing", async () => {
    await indexCommand([]);

    expect(mockAcquireIndexLock).toHaveBeenCalledWith(
      "/tmp/sesame-test-data",
      "index",
    );
    expect(db.close).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("releases lock when indexing throws", async () => {
    mockIndexSessions.mockRejectedValueOnce(new Error("boom"));

    await expect(indexCommand([])).rejects.toThrow("boom");

    expect(db.close).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  test("fails fast when lock is already held", async () => {
    mockAcquireIndexLock.mockImplementationOnce(() => {
      throw new Error("Index already running (watch pid=123)");
    });

    await expect(indexCommand([])).rejects.toThrow("Index already running");

    expect(mockOpenDatabase).not.toHaveBeenCalled();
  });
});
