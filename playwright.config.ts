import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 30000,
  webServer: {
    command: "pnpm build && pnpm start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
