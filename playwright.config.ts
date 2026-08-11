import { defineConfig } from "@playwright/test";

// Local runs reuse the developer's dev server (start-essenly.command) and the
// installed Chrome — no browser download. CI builds first, then starts the
// production server. Auth-dependent specs self-skip when the Supabase
// service-role key isn't available (e.g. on CI without secrets).
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  // dev-server on-demand compiles make first hits slow — expect() must wait
  // past a cold route compile, not just a paint
  expect: { timeout: 15_000 },
  fullyParallel: false, // specs share one auth test user
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
