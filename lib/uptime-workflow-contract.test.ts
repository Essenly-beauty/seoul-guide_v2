import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** 2026-09-18~20 incident: the Supabase Free project auto-paused after 7 idle
 *  days and production sign-in was dead for ~40 hours while Uptime stayed
 *  green — it only probed Vercel routes. The 30-minute cron must therefore
 *  (a) hit Supabase Auth health and a REST endpoint so an outage is DOWN, and
 *  (b) thereby count as API activity that prevents the idle pause. */
describe("uptime workflow probes Supabase", () => {
  const yml = readFileSync(join(process.cwd(), ".github/workflows/uptime.yml"), "utf8");
  it("calls the Auth health endpoint and a REST endpoint with the anon key", () => {
    expect(yml).toMatch(/\/auth\/v1\/health/);
    expect(yml).toMatch(/\/rest\/v1\//);
    expect(yml).toMatch(/secrets\.SUPABASE_URL/);
    expect(yml).toMatch(/secrets\.SUPABASE_ANON_KEY/);
    expect(yml).toMatch(/apikey/);
  });
  it("treats a non-2xx Supabase answer as DOWN (403 is fine for Vercel's bot challenge, not for Supabase)", () => {
    expect(yml).toMatch(/probe_supabase|supabase\(\)|# Supabase/);
    expect(yml).toMatch(/2\*\) echo "OK/);
  });
});
