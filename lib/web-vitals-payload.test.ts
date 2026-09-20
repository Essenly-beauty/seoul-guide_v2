import { describe, expect, it } from "vitest";
import { normalizeVitalsPayload, VITAL_NAMES } from "./web-vitals-payload";

/** Core Web Vitals are judged on FIELD data at p75 (web.dev). The browser
 *  beacons useReportWebVitals metrics to /api/vitals, which is a public,
 *  unauthenticated endpoint — so every field is validated and capped here
 *  before it can reach the write-only web_vitals table. */
describe("normalizeVitalsPayload", () => {
  const good = {
    name: "INP", value: 184.4, rating: "needs-improvement", id: "v4-1717000000000-1234567890",
    navigationType: "navigate", page: "/map", target: "button.map-fab",
  };

  it("accepts a well-formed metric and echoes the fields the table stores", () => {
    expect(normalizeVitalsPayload(good)).toEqual({
      name: "INP", value: 184.4, rating: "needs-improvement", metric_id: "v4-1717000000000-1234567890",
      navigation_type: "navigate", page: "/map", target: "button.map-fab",
    });
  });

  it("knows the current metric set (INP replaced FID in 2024; TTFB/FCP kept for diagnosis)", () => {
    expect([...VITAL_NAMES]).toEqual(["LCP", "INP", "CLS", "FCP", "TTFB"]);
    expect(normalizeVitalsPayload({ ...good, name: "FID" })).toBeNull();
    expect(normalizeVitalsPayload({ ...good, name: "lcp" })).toBeNull();
  });

  it("rejects non-finite, negative or absurd values and unknown ratings", () => {
    expect(normalizeVitalsPayload({ ...good, value: Number.NaN })).toBeNull();
    expect(normalizeVitalsPayload({ ...good, value: -1 })).toBeNull();
    expect(normalizeVitalsPayload({ ...good, value: 10_000_000 })).toBeNull();
    expect(normalizeVitalsPayload({ ...good, rating: "great" })).toBeNull();
    expect(normalizeVitalsPayload("INP")).toBeNull();
    expect(normalizeVitalsPayload(null)).toBeNull();
  });

  it("keeps only the pathname of the page and caps free-text lengths", () => {
    const row = normalizeVitalsPayload({ ...good, page: "/map?place=x&code=secret#access_token=abc", target: "x".repeat(500) })!;
    expect(row.page).toBe("/map");
    expect(row.target).toHaveLength(200);
  });

  it("tolerates missing optional fields", () => {
    const row = normalizeVitalsPayload({ name: "CLS", value: 0.02, rating: "good", id: "v4-1", page: "/" })!;
    expect(row).toMatchObject({ name: "CLS", value: 0.02, rating: "good", page: "/", navigation_type: null, target: null });
  });
});

describe("web vitals wiring", () => {
  const { readFileSync, readdirSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the root layout mounts the reporter as its own client component (minimal client boundary)", () => {
    expect(read("app/layout.tsx")).toMatch(/<WebVitalsReporter \/>/);
    const reporter = read("components/system/web-vitals-reporter.tsx");
    expect(reporter).toMatch(/^"use client";/);
    expect(reporter).toMatch(/useReportWebVitals/);
    expect(reporter).toMatch(/sendBeacon/);
  });

  it("/api/vitals validates through normalizeVitalsPayload and never caches", () => {
    const route = read("app/api/vitals/route.ts");
    expect(route).toMatch(/export async function POST/);
    expect(route).toMatch(/normalizeVitalsPayload\(/);
    expect(route).toMatch(/no-store/);
  });

  it("a migration creates write-only web_vitals with the same metric/rating checks", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const sql = readdirSync(dir).filter((f) => f.includes("web_vitals")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    expect(sql).toMatch(/create table if not exists public\.web_vitals/);
    for (const n of VITAL_NAMES) expect(sql).toContain(`'${n}'`);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/for insert/);
    expect(sql).not.toMatch(/for select/);
  });
});
