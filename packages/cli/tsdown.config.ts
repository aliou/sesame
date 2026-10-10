import { defineConfig } from "tsdown";

// `tsdown` bundles the CLI into dist/sesame.cjs. `SESAME_EXE=1 tsdown`
// builds Node SEA binaries instead, into dist-sea/ with a platform-arch
// suffix. @tsdown/exe downloads each target's Node.js binary (cached in
// ~/.cache/tsdown/node) and injects the bundle into it.
//
// Note: useCodeCache/useSnapshot must stay false (the default) for
// cross-platform SEAs, otherwise the executable crashes on another platform.
// See https://nodejs.org/api/single-executable-applications.html
const isExe = process.env.SESAME_EXE === "1";

const exe = isExe
  ? {
      fileName: "sesame",
      outDir: "dist-sea",
      targets: [
        {
          platform: "darwin" as const,
          arch: "arm64" as const,
          nodeVersion: "26.3.1",
        },
        {
          platform: "linux" as const,
          arch: "arm64" as const,
          nodeVersion: "26.3.1",
        },
        {
          platform: "linux" as const,
          arch: "x64" as const,
          nodeVersion: "26.3.1",
        },
      ],
    }
  : undefined;

export default defineConfig({
  entry: { sesame: "sesame.ts" },
  outDir: isExe ? "dist-sea" : "dist",
  format: "cjs",
  dts: false,
  clean: true,
  target: "node26",
  // The bundle and the SEA have no node_modules: bundle everything.
  deps: { alwaysBundle: [/.*/] },
  exe,
});
