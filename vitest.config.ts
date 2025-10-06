import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup/test-env.ts"],
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    exclude: ["tests/e2e/**", "tests/perf/**"],
  },
});
