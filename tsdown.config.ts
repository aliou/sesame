import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["packages/cli/sesame.ts"],
  format: "cjs",
  exe: {
    fileName: "sesame",
    seaConfig: {
      disableExperimentalSEAWarning: true,
      useCodeCache: true,
    },
  },
});
