import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["sesame.ts"],
    format: "cjs",
    exe: {
      fileName: "sesame",
      seaConfig: {
        disableExperimentalSEAWarning: true,
        useCodeCache: true,
      },
    },
  },
});
