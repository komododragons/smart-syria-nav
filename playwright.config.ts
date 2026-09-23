import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env["TEST_APP_ORIGIN"] ?? "http://localhost:8080",
    launchOptions: chromiumExecutable
      ? { executablePath: chromiumExecutable }
      : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});