import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const fixtureDir = fileURLToPath(
  new URL("fixtures/packed-library", import.meta.url),
);

let testDir: string;
let consumerDir: string;

beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), "sesame-package-"));
  execFileSync("pnpm", ["pack", "--pack-destination", testDir], {
    cwd: packageDir,
    stdio: "pipe",
  });
  const tarballName = readdirSync(testDir).find((name) =>
    name.endsWith(".tgz"),
  );
  if (!tarballName) throw new Error("Package tarball was not created");

  consumerDir = join(testDir, "consumer");
  cpSync(fixtureDir, consumerDir, { recursive: true });
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      join(testDir, tarballName),
    ],
    { cwd: consumerDir, stdio: "pipe" },
  );
}, 30_000);

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function typecheck(
  file: string,
  moduleResolution: "node16" | "nodenext" | "bundler",
  skipLibCheck: boolean,
) {
  return spawnSync(
    "tsc",
    [
      "--noEmit",
      "--strict",
      "--target",
      "es2022",
      "--module",
      moduleResolution === "bundler" ? "esnext" : moduleResolution,
      "--moduleResolution",
      moduleResolution,
      "--skipLibCheck",
      String(skipLibCheck),
      file,
    ],
    { cwd: consumerDir, encoding: "utf8" },
  );
}

function output(result: ReturnType<typeof typecheck>): string {
  return `${result.stdout}${result.stderr}`;
}

describe("packed library", () => {
  for (const moduleResolution of ["node16", "nodenext", "bundler"] as const) {
    for (const skipLibCheck of [true, false]) {
      test(`checks ${moduleResolution} types with skipLibCheck=${skipLibCheck}`, () => {
        const valid = typecheck("valid.ts", moduleResolution, skipLibCheck);
        expect(valid.status, output(valid)).toBe(0);

        const invalid = typecheck("invalid.ts", moduleResolution, skipLibCheck);
        expect(invalid.status).not.toBe(0);
        expect(output(invalid)).toContain("TS2322");
        expect(output(invalid)).not.toContain("TS2834");
      });
    }
  }

  test("loads the runtime and worker exports", () => {
    const stdout = execFileSync(
      process.execPath,
      [join(consumerDir, "runtime.mjs"), join(testDir, "data")],
      { cwd: consumerDir, encoding: "utf8" },
    );
    expect(stdout.trim()).toBe("runtime exports ok");
  });
});
