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
  // `channel: 'chromium'` opts into Chrome's new headless mode, which uses
  // the full Chromium binary instead of the separate `chromium-headless-shell`
  // download. Combined with `playwright install --no-shell` in CI this
  // halves the install surface and sidesteps the cdn.playwright.dev
  // headless-shell stall observed in PR #16 (2026-06-02).
  projects: [{ name: "chromium", use: { browserName: "chromium", channel: "chromium" } }],
});
