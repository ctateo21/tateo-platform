import { execFileSync } from "node:child_process";
import { defineConfig } from "@playwright/test";

function findSystemChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  try {
    return execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const chromiumExecutable = findSystemChromium();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: {
      ...(chromiumExecutable ? { executablePath: chromiumExecutable } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  webServer: {
    command:
      "SUPABASE_SERVICE_ROLE_KEY= " +
      "VITE_SUPABASE_URL=https://browser-test.supabase.co " +
      "VITE_SUPABASE_ANON_KEY=browser-test-anon-key-with-more-than-twenty-characters " +
      "npm run dev",
    url: "http://127.0.0.1:5000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});