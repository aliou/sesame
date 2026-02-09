#!/usr/bin/env bun

import { $ } from "bun";
import { mkdir } from "node:fs/promises";

const targets = [
  { target: "bun-darwin-arm64", output: "sesame-darwin-arm64" },
  { target: "bun-linux-arm64", output: "sesame-linux-arm64" },
  { target: "bun-linux-x64", output: "sesame-linux-x64" },
];

// Ensure dist directory exists
await mkdir("dist", { recursive: true });

console.log("Building binaries...");

for (const { target, output } of targets) {
  console.log(`  → ${output} (${target})`);
  await $`bun build --compile --minify --target=${target} --outfile=dist/${output} src/sesame.ts`;
}

console.log("✓ All binaries built successfully");
