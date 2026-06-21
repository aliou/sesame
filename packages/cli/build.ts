#!/usr/bin/env node

/**
 * Build single-executable binaries for all targets via tsdown + @tsdown/exe.
 *
 * Node SEA does not support cross-compilation natively; @tsdown/exe works
 * around this by downloading each target platform's Node.js binary and
 * injecting the blob there. Output (platform-arch suffixed):
 *
 *   dist/sesame-darwin-arm64
 *   dist/sesame-linux-arm64
 *   dist/sesame-linux-x64
 */

import { execSync } from "node:child_process";

console.log("Building cross-platform SEA binaries...");
execSync("pnpm exec tsdown", { stdio: "inherit" });
console.log("Done.");
