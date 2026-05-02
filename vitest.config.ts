import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirror tsconfig.json `paths`: `@/*` → `src/*`. Required for tests that
      // import production modules using the same `@/` aliases the routes use.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    pool: "forks",
    globalSetup: ["./tests/setup/global.ts"],
    setupFiles: ["./tests/setup/db.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/risk/**/*.ts"],
      exclude: ["src/lib/risk/**/*.test.ts", "src/lib/risk/types.ts"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
      reporter: ["text", "json-summary"],
    },
  },
});
