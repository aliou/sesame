import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";

function getBunTarget(): string | null {
  const archMap: Record<string, string> = {
    arm64: "arm64",
    x64: "x64",
  };

  const arch = archMap[process.arch];
  if (!arch) {
    return null;
  }

  return `bun-${process.platform}-${arch}`;
}

describe("compiled binary", () => {
  test("status command works in Bun binary", () => {
    const target = getBunTarget();
    if (!target) {
      return;
    }

    const root = process.cwd();
    const tmpRoot = mkdtempSync(join(tmpdir(), "sesame-bun-test-"));
    const outFile = join(tmpRoot, "sesame-test-binary");

    try {
      const build = Bun.spawnSync([
        "bun",
        "build",
        "--compile",
        `--target=${target}`,
        `--outfile=${outFile}`,
        "src/sesame.ts",
      ], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(build.exitCode).toBe(0);

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

      const run = Bun.spawnSync([outFile, "status"], {
        cwd: root,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(run.exitCode).toBe(0);

      const stdout = run.stdout.toString();
      expect(stdout).toContain("Sesame Index Status");
      expect(stdout).toContain("Sessions: 0");
      expect(stdout).toContain("Chunks:");
      expect(stdout).toContain("Database:");
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
