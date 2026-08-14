import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3014",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "NEXT_DIST_DIR=.next-e2e npm run dev -- -p 3014",
    url: "http://localhost:3014/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
