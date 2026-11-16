import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const packageDir = fileURLToPath(new URL(".", import.meta.url));
const compiler = join(
  dirname(require.resolve("typescript/package.json")),
  "bin",
  "tsc",
);
const typeRoots = dirname(dirname(require.resolve("@types/node/package.json")));
let directory: string;
let consumer: string;

beforeAll(() => {
  const packageManager = process.env.npm_execpath;
  if (!packageManager) throw new Error("Run the package tests through pnpm.");
  directory = mkdtempSync(join(tmpdir(), "sesame-package-types-"));
  execFileSync(
    process.execPath,
    [packageManager, "pack", "--pack-destination", directory],
    {
      cwd: packageDir,
      env: { ...process.env, npm_config_ignore_scripts: "true" },
      stdio: "pipe",
      timeout: 30_000,
    },
  );
  const tarball = readdirSync(directory).find((file) => file.endsWith(".tgz"));
  if (!tarball) throw new Error("Package tarball was not produced.");
  consumer = join(directory, "consumer");
  const installed = join(consumer, "node_modules", "@aliou", "sesame");
  mkdirSync(installed, { recursive: true });
  execFileSync(
    "tar",
    ["-xf", join(directory, tarball), "-C", installed, "--strip-components=1"],
    {
      timeout: 30_000,
    },
  );
  expect(existsSync(join(installed, "dist", "test-helpers"))).toBe(false);
  writeFileSync(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}',
  );
  writeFileSync(
    join(consumer, "valid.ts"),
    `import { getSkillsForSessions, openDatabase, search } from "@aliou/sesame";
type AnyExports<T> = { [K in keyof T]: 0 extends 1 & T[K] ? K : never }[keyof T];
type AssertNever<T extends never> = T;
export type TypedExports = AssertNever<AnyExports<typeof import("@aliou/sesame")>>;
const db = openDatabase(":memory:");
const results = search(db, "*");
export const bySession = getSkillsForSessions(db, results.map((r) => r.sessionId));
`,
  );
  writeFileSync(
    join(consumer, "invalid.ts"),
    'import { indexFile } from "@aliou/sesame";\nexport const probe: symbol = indexFile;\n',
  );
}, 30_000);

afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

for (const resolution of ["Node16", "NodeNext", "Bundler"]) {
  for (const skipLibCheck of [false, true]) {
    test(`packed types resolve with ${resolution}, skipLibCheck=${skipLibCheck}`, () => {
      const options = [
        compiler,
        "--noEmit",
        "--strict",
        "--target",
        "ES2022",
        "--module",
        resolution === "Bundler" ? "ESNext" : resolution,
        "--moduleResolution",
        resolution,
        "--typeRoots",
        typeRoots,
        "--skipLibCheck",
        String(skipLibCheck),
      ];
      const valid = spawnSync(process.execPath, [...options, "valid.ts"], {
        cwd: consumer,
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(valid.error).toBeUndefined();
      expect(valid.status, valid.stdout + valid.stderr).toBe(0);
      const invalid = spawnSync(process.execPath, [...options, "invalid.ts"], {
        cwd: consumer,
        encoding: "utf8",
        timeout: 30_000,
      });
      expect(invalid.error).toBeUndefined();
      expect(invalid.status).not.toBe(0);
      expect(invalid.stdout + invalid.stderr).toContain("error TS2322:");
    });
  }
}
