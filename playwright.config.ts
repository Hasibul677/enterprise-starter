import { defineConfig, devices } from "@playwright/test";

/**
 * NOTE: Playwright requires downloading browser binaries
 * (`npx playwright install`), which needs outbound network access to
 * playwright.azureedge.net / CDN mirrors. This is NOT reachable from the
 * sandboxed environment this starter was scaffolded in, so these specs are
 * written and typechecked but have not been executed here. Run
 * `npx playwright install --with-deps` once on your own machine, then
 * `yarn test:e2e`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
