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
    // P4 policy: no skipped/pending tests in CI. Custom reporter fails the run
    // when CI=1 and any test resolved as skipped or todo. Local dev still
    // permits `.skipIf(condition)` env guards.
    reporters: process.env.CI ? ["default", "./tests/reporters/no-skip.ts"] : ["default"],
    // Pre-extended in Wave 0 (plan 04-01) so Wave 1 plans 04-04 (scripts/)
    // and 04-05 (tests/contract/) do not race-edit this file. Resolves W-4.
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/tests/e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/risk/**/*.ts"],
      exclude: [
        "src/lib/risk/**/*.test.ts",
        "src/lib/risk/**/*.type-test.ts",
        "src/lib/risk/types.ts",
      ],
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
