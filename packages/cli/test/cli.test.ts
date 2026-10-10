import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("compiled binary", () => {
  test("status command works in SEA binary", () => {
    const root = process.cwd();
    const tmpRoot = mkdtempSync(join(tmpdir(), "sesame-sea-test-"));

    try {
      // Build the SEA binaries into dist-sea/.
      execSync("pnpm exec tsdown", {
        cwd: root,
        env: { ...process.env, SESAME_EXE: "1" },
        stdio: "pipe",
      });

      const outFile = join(
        root,
        "dist-sea",
        `sesame-${process.platform}-${process.arch}`,
      );

      const xdgDataHome = join(tmpRoot, "xdg-data");
      const xdgConfigHome = join(tmpRoot, "xdg-config");
      const xdgCacheHome = join(tmpRoot, "xdg-cache");

      mkdirSync(xdgDataHome, { recursive: true });
      mkdirSync(xdgConfigHome, { recursive: true });
      mkdirSync(xdgCacheHome, { recursive: true });

      const env = {
        ...process.env,
        XDG_DATA_HOME: xdgDataHome,
        XDG_CONFIG_HOME: xdgConfigHome,
        XDG_CACHE_HOME: xdgCacheHome,
      };

      const exec = (args: string) =>
        execSync(`${outFile} ${args}`, { cwd: root, env, encoding: "utf-8" });

      const stdout = exec("status");
      expect(stdout).toMatch(/SESSIONS\s+0/);
      expect(stdout).toMatch(/LAST SYNC\s+never/);

      // Bundled dependencies (Brocli, tab) load inside the SEA.
      expect(exec("--version").trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(JSON.parse(exec("-o json status"))).toMatchObject({
        sessionCount: 0,
        lastSyncAt: null,
      });
      expect(exec("completion bash")).toContain("sesame");
      expect(() => exec("bogus")).toThrow(
        expect.objectContaining({ status: 2 }),
      );
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
