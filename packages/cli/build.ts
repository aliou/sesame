#!/usr/bin/env node

/**
 * Build a single-executable binary for the current platform using tsdown's
 * Node.js SEA support. Cross-compilation is not supported by Node SEA, so
 * CI runners are needed for other targets.
 */

import { execSync } from "node:child_process";

console.log("Building binary for current platform...");
execSync("npx tsdown --config ../../tsdown.config.ts", { stdio: "inherit" });
console.log("Done.");
