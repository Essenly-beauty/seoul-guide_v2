import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { load } from "cheerio";
import data from "./subway-data.json";

const svg = readFileSync("components/subway/seoul-metro.svg", "utf8");

describe("processed subway svg", () => {
  it("has a hit target for ≥95% of dataset stations", () => {
    const ids = Object.keys(data.stations);
    const wired = ids.filter((id) => svg.includes(`data-station="${id}"`));
    expect(wired.length / ids.length).toBeGreaterThanOrEqual(0.95);
  });
  it("beauty-zone core stations are 100% wired and labeled in English", () => {
    // The 12 anchor stations Task W1 gates on: every one must have both a
    // tap target and a data-label-for tag, no exceptions.
    const beautyZone = [
      "gangnam",
      "nonhyeon",
      "sinsa",
      "apgujeong",
      "apgujeong_rodeo",
      "cheongdam",
      "gangnamgu_office",
      "hongik_univ",
      "myeongdong",
      "seongsu",
      "yeoksam",
      "seolleung",
    ];
    for (const id of beautyZone) {
      expect(svg, id).toContain(`data-station="${id}"`);
      expect(svg, id).toContain(`data-label-for="${id}"`);
    }
    expect(svg).toContain(">Gangnam<");
  });
  it("no Korean label text remains on station labels", () => {
    const $ = load(svg, { xml: true });
    const labels = $("[data-label-for]");
    expect(labels.length).toBeGreaterThan(500); // guard: selector actually finds labels
    labels.each((_, el) => {
      const text = $(el).text();
      expect(text, $(el).attr("data-label-for")).not.toMatch(/[가-힣]/);
    });
  });
  it("keeps Wikimedia PD-self attribution (not the old Sinseiki MIT notice)", () => {
    expect(svg).toMatch(/Wikimedia/);
    expect(svg).toMatch(/PD-self/);
    expect(svg).toMatch(/IRTC1015/);
    expect(svg).not.toMatch(/MIT/);
  });
  it("no percentage font-size on labels (resolves against root, not class size)", () => {
    expect(svg).not.toMatch(/font-size:\s*\d+%/);
  });
  it("inline label font sizes are absolute px (via --lbl-fs, not a literal font-size)", () => {
    // Every label carries an inline size as a `--lbl-fs` custom property
    // rather than a literal `font-size` declaration — a literal inline
    // font-size would always beat the zoom-tier rules in app/globals.css
    // ([data-zoom="mid"] .lbl-minor, [data-zoom="far"] .lbl-major), freezing
    // every label at its near-tier size when zoomed out. See
    // LABEL_SIZE_SCALE/LABEL_MAJOR_SCALE in scripts/build-subway-svg.mjs.
    const sizes = [
      ...svg.matchAll(/data-label-for="[^"]+"[^>]*style="[^"]*--lbl-fs:\s*([\d.]+)px/g),
    ].map((m) => parseFloat(m[1]));
    expect(sizes.length).toBeGreaterThan(500); // guard: covers ~all labels
    for (const s of sizes) {
      // This base map's native label font-size (st50) is 18px in its own
      // 5724-wide viewBox — an order of magnitude bigger than the previous
      // (Sinseiki, ~1150-wide) base map's — so bounds are scaled up
      // accordingly. The +18%/+10% Kakao-style bump keeps every label's
      // near-tier size within this range (measured ~19-23px on the current
      // build); W2 retunes the client-side scale these are viewed at.
      expect(s).toBeGreaterThan(15);
      expect(s).toBeLessThan(30);
    }
  });
});

describe("generated metro-svg.ts module", () => {
  it("exists and exports METRO_SVG matching the artifact", () => {
    expect(existsSync("components/subway/metro-svg.ts")).toBe(true);
    const mod = readFileSync("components/subway/metro-svg.ts", "utf8");
    expect(mod).toMatch(/export const METRO_SVG/);
    expect(mod).toMatch(/eslint-disable/);
  });
});
