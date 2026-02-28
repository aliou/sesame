import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/sesame.ts"],
  format: "cjs",
  exe: {
    fileName: "sesame",
    seaConfig: {
      disableExperimentalSEAWarning: true,
      useCodeCache: true,
    },
  },
});
