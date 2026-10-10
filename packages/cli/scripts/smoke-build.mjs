// Smoke test for the built CLI bundle, adapted from sbxctl.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const bin = resolve(pkg.bin.sesame);
const artifact = readFileSync(bin, "utf8");

if (!artifact.startsWith("#!/usr/bin/env node\n")) {
  throw new Error(`built bin is missing a Node shebang: ${bin}`);
}
if ((statSync(bin).mode & 0o111) === 0) {
  throw new Error(`built bin is not executable: ${bin}`);
}

for (const args of [["--version"], ["--help"], ["completion", "bash"]]) {
  execFileSync(process.execPath, [bin, ...args], { stdio: "pipe" });
}

const unknown = spawnSync(process.execPath, [bin, "not-a-command"], {
  encoding: "utf8",
});
if (unknown.error) throw unknown.error;
if (unknown.status !== 2) {
  throw new Error(`unknown command exited ${unknown.status}`);
}
if (!unknown.stderr) {
  throw new Error("unknown command did not print a stderr diagnostic");
}
