import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { load } from "cheerio";
import data from "./subway-data.json";

const svg = readFileSync("components/subway/seoul-metro.svg", "utf8");

describe("processed subway svg", () => {
  it("has a hit target for ≥97% of dataset stations", () => {
    const ids = Object.keys(data.stations);
    const wired = ids.filter((id) => svg.includes(`data-station="${id}"`));
    expect(wired.length / ids.length).toBeGreaterThan(0.97);
  });
  it("anchor stations are wired and labeled in English", () => {
    for (const id of ["gangnam", "nonhyeon", "hongik_univ", "myeongdong", "apgujeong_rodeo"]) {
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
  it("keeps MIT notice", () => {
    expect(svg).toMatch(/MIT/);
    expect(svg).toMatch(/Sinseiki|opensource-seoul-subway-map/);
  });
  it("no percentage font-size on labels (resolves against root, not class size)", () => {
    expect(svg).not.toMatch(/font-size:\s*\d+%/);
  });
  it("inline label font sizes are small absolute px (via --lbl-fs, not a literal font-size)", () => {
    // Task S7: every label (not just the >12-char shrunk ones) now carries an
    // inline size, but as a `--lbl-fs` custom property rather than a literal
    // `font-size` declaration — a literal inline font-size would always beat
    // the zoom-tier rules in app/globals.css ([data-zoom="mid"] .lbl-minor,
    // [data-zoom="far"] .lbl-major), freezing every label at its near-tier
    // size when zoomed out. See LABEL_SIZE_SCALE/LABEL_MAJOR_SCALE in
    // scripts/build-subway-svg.mjs and the matching CSS rule's comment.
    const sizes = [
      ...svg.matchAll(/data-label-for="[^"]+"[^>]*style="[^"]*--lbl-fs:\s*([\d.]+)px/g),
    ].map((m) => parseFloat(m[1]));
    expect(sizes.length).toBeGreaterThan(500); // guard: now covers ~all labels, not just the shrunk ones
    for (const s of sizes) {
      // Bounds unchanged from pre-S7: the +18%/+10% Kakao-style bump keeps
      // every label's near-tier size well within this range (measured min
      // ~2.36px, max ~5.5px across the current build).
      expect(s).toBeGreaterThan(2);
      expect(s).toBeLessThan(10);
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
