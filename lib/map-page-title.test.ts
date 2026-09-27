import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/map/page.tsx", import.meta.url), "utf8");

describe("map page title", () => {
  it("is the app's name alone, because that is what a bookmark or Home Screen shortcut gets called", () => {
    // Owner, real iPhone (2026-09-27): adding a bookmark from the map offered
    // "Map — MYSEOULDROP". The map is the app's start screen, not a section.
    expect(page).not.toContain("Map — MYSEOULDROP");
    expect(page).toContain('title: "MYSEOULDROP"');
  });
});
