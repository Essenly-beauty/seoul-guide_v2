import { defineConfig } from "@playwright/test";

const externalOnly = process.env.E2E_EXTERNAL_ONLY === "1";
const includeWebKitRanking = process.env.E2E_WEBKIT === "1";

// Local runs start an isolated server so QA-only fixtures cannot silently use
// an unrelated reused process. CI builds first, then starts the production
// server on the same dedicated port. Auth-dependent specs self-skip when the Supabase
// service-role key isn't available (e.g. on CI without secrets). A production
// smoke run can target an already-deployed URL without starting a second app.
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
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
    ...(includeWebKitRanking
      ? [{
          name: "webkit-ranking",
          testMatch: "**/ranking-retailers.spec.ts",
          use: { browserName: "webkit" as const },
        }]
      : []),
  ],
  webServer: externalOnly
    ? undefined
    : {
        command: process.env.CI
          ? "npm run start -- --hostname 127.0.0.1 --port 3001"
          : "npm run dev -- --hostname 127.0.0.1 --port 3001",
        url: "http://127.0.0.1:3001",
        reuseExistingServer: false,
        timeout: 120_000,
        // Makes the guarded /ranking/qa route available only to a server that
        // Playwright starts. Normal development and deployed servers return 404.
        env: { RANKING_E2E_HARNESS: "1" },
      },
});
