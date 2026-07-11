import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
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
    const labels = svg.match(/data-label-for="[^"]+"[^>]*>([^<]+)</g) ?? [];
    for (const l of labels) expect(l).not.toMatch(/[가-힣]/);
  });
  it("keeps MIT notice", () => {
    expect(svg).toMatch(/MIT/);
    expect(svg).toMatch(/Sinseiki|opensource-seoul-subway-map/);
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
