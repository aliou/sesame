import { closeSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface LockFileData {
  pid?: number;
  holder?: string;
  startedAt?: string;
}

export interface IndexLockHandle {
  path: string;
  release: () => void;
}

const STALE_UNKNOWN_LOCK_MS = 5 * 60 * 1000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "EPERM"
    ) {
      return true;
    }
    return false;
  }
}

function parseLockFile(lockPath: string): LockFileData | null {
  try {
    const raw = readFileSync(lockPath, "utf8").trim();
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
}

function removeStaleLockIfSafe(lockPath: string): boolean {
  const data = parseLockFile(lockPath);

  if (data?.pid && Number.isInteger(data.pid) && data.pid > 0) {
    if (!isProcessAlive(data.pid)) {
      unlinkSync(lockPath);
      return true;
    }
    return false;
  }

  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    if (ageMs > STALE_UNKNOWN_LOCK_MS) {
      unlinkSync(lockPath);
      return true;
    }
  } catch {
    // If stat fails, treat as not removable.
  }

  return false;
}

export function acquireIndexLock(dataDir: string, holder: string): IndexLockHandle {
  const lockPath = join(dataDir, "index.lock");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, "wx");
      try {
        writeFileSync(
          fd,
          JSON.stringify({
            pid: process.pid,
            holder,
            startedAt: new Date().toISOString(),
          }),
          "utf8",
        );
      } finally {
        closeSync(fd);
      }

      let released = false;
      return {
        path: lockPath,
        release: () => {
          if (released) {
            return;
          }
          released = true;
          try {
            unlinkSync(lockPath);
          } catch {
            // Ignore lock cleanup failures on shutdown.
          }
        },
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "EEXIST"
      ) {
        if (attempt === 0 && removeStaleLockIfSafe(lockPath)) {
          continue;
        }

        const data = parseLockFile(lockPath);
        const owner = data?.holder ?? "unknown";
        const pid = data?.pid ? ` pid=${data.pid}` : "";
        const startedAt = data?.startedAt ? ` startedAt=${data.startedAt}` : "";
        throw new Error(`Index already running (${owner}${pid}${startedAt}). Try again later.`);
      }

      throw error;
    }
  }

  throw new Error("Failed to acquire index lock");
}
