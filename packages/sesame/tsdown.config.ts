import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: { index: "index.ts" },
    outDir: "dist",
    format: "esm",
    dts: true,
    clean: true,
  },
  {
    entry: { "storage/search-worker": "storage/search-worker.ts" },
    outDir: "dist",
    format: "esm",
    dts: false,
    clean: false,
  },
]);
