import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@aliou/sesame": fileURLToPath(
        new URL("../sesame/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["test/**", "node_modules/**"],
    mockReset: true,
  },
});
