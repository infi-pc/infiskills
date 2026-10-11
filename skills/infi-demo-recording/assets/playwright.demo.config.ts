import fs from "node:fs";
import { defineConfig } from "@playwright/test";

// Node 22+ loads optional local configuration without a dotenv dependency.
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  testDir: "./playwright/demos",
  testMatch: /.*\.demo\.ts/,
  outputDir: "./.demo-out",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: "list",
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`,
    storageState: process.env.DEMO_STORAGE_STATE || undefined,
    browserName: "chromium",
    channel: process.env.DEMO_BROWSER_CHANNEL || undefined,
    trace: "retain-on-failure",
    timezoneId: process.env.DEMO_TIMEZONE ?? "UTC",
    locale: "en-US",
    colorScheme: "light",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    video: { mode: "on", size: { width: 1440, height: 900 } },
  },
});
