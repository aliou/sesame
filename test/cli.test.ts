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
      // Build the SEA binary into a temp directory.
      execSync(`npx tsdown --outDir ${tmpRoot}`, {
        cwd: root,
        stdio: "pipe",
      });

      const outFile = join(tmpRoot, "sesame");

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

      const stdout = execSync(`${outFile} status`, {
        cwd: root,
        env,
        encoding: "utf-8",
      });

      expect(stdout).toContain("Sesame Index Status");
      expect(stdout).toContain("Sessions: 0");
      expect(stdout).toContain("Chunks:");
      expect(stdout).toContain("Database:");
      expect(stdout).toContain("Last sync: never");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
