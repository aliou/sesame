import { defineConfig } from "tsdown";

// Cross-platform SEA build via @tsdown/exe.
// A single `tsdown` invocation downloads the target platform's Node.js
// binary (cached in ~/.cache/tsdown/node) and emits one executable per
// target into dist/ with a platform-arch suffix.
//
// Note: useCodeCache/useSnapshot must be false for cross-platform SEAs,
// otherwise the generated executable crashes on a different platform.
// See https://nodejs.org/api/single-executable-applications.html
export default defineConfig({
  entry: ["sesame.ts"],
  format: "cjs",
  deps: {
    alwaysBundle: ["@aliou/sesame"],
  },
  exe: {
    fileName: "sesame",
    outDir: "dist",
    targets: [
      { platform: "darwin", arch: "arm64", nodeVersion: "26.3.1" },
      { platform: "linux", arch: "arm64", nodeVersion: "26.3.1" },
      { platform: "linux", arch: "x64", nodeVersion: "26.3.1" },
    ],
  },
});
