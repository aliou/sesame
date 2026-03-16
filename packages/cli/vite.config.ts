import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["sesame.ts"],
    format: "cjs",
    deps: {
      alwaysBundle: ["@aliou/sesame"],
    },
    exe: {
      fileName: "sesame",
      seaConfig: {
        disableExperimentalSEAWarning: true,
        useCodeCache: true,
      },
    },
  },
});
