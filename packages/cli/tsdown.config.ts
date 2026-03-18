import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["sesame.ts"],
  format: "cjs",
  noExternal: ["@aliou/sesame"],
  exe: {
    fileName: "sesame",
    seaConfig: {
      disableExperimentalSEAWarning: true,
      useCodeCache: true,
    },
  },
});
