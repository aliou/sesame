import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";

function supportsSeaBuild(): boolean {
  const [major = "0", minor = "0"] = process.versions.node.split(".");
  return Number(major) > 25 || (Number(major) === 25 && Number(minor) >= 7);
}

describe("compiled binary", () => {
  test("status command works in SEA binary", () => {
    if (!supportsSeaBuild()) {
      return;
    }

    const root = process.cwd();
    const cliDir = join(root, "packages/cli");
    const tmpRoot = mkdtempSync(join(tmpdir(), "sesame-sea-test-"));

    try {
      execSync(`vp pack --outDir ${tmpRoot}`, {
        cwd: cliDir,
        stdio: "pipe",
      });

      const outFile = join(tmpRoot, "build", "sesame");

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
