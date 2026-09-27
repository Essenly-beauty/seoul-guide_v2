import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldOfferFilterReset } from "./filter-empty-policy";

// Owner request 2026-09-27: when the filters the visitor just applied match
// nothing, the map goes blank with no explanation. Ask them, in a modal,
// whether they want to change the filters. The policy is narrow on purpose:
// only right after an Apply, only when at least one filter is on, only when
// the result is empty. Panning the map into the sea with no filters on is
// not a filter problem and must not trigger it.
describe("empty-result filter prompt", () => {
  const base = { resultCount: 0, activeFilters: 2, justApplied: true };

  it("asks when a fresh Apply produced nothing", () => {
    expect(shouldOfferFilterReset(base)).toBe(true);
  });

  it("stays quiet when something matched", () => {
    expect(shouldOfferFilterReset({ ...base, resultCount: 1 })).toBe(false);
  });

  it("stays quiet when no filter is on — an empty map is not a filter problem", () => {
    expect(shouldOfferFilterReset({ ...base, activeFilters: 0 })).toBe(false);
  });

  it("stays quiet unless the visitor just applied — no nagging on pan, zoom or data changes", () => {
    expect(shouldOfferFilterReset({ ...base, justApplied: false })).toBe(false);
  });
});

// The policy decides; these pin the wires that let it reach the visitor.
describe("empty-result prompt wiring", () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, "..", path), "utf8");
  const screen = read("components/map/map-screen.tsx");

  it("consults the policy and renders the modal from the map screen", () => {
    expect(screen).toMatch(/shouldOfferFilterReset\(\{ resultCount: places\.length, activeFilters: activeFilterCount, justApplied: true \}\)/);
    expect(screen).toMatch(/<FilterEmptyModal/);
  });

  it("arms the prompt only from the filter sheet's Apply", () => {
    // The ref is set in exactly one place, and the effect clears it before it
    // decides, so a later pan or data change can never reuse a stale Apply.
    expect(screen.split("justAppliedFiltersRef.current = true").length - 1).toBe(1);
    expect(screen).toMatch(/onApply=\{\(nextFilters\) => \{\s*justAppliedFiltersRef\.current = true;/);
    // and applies a fresh object, so re-applying an unchanged empty set
    // still re-renders and still asks
    expect(screen).toMatch(/setFilters\(\{ \.\.\.nextFilters \}\)/);
    expect(screen).toMatch(/if \(!justAppliedFiltersRef\.current\) return;\s*justAppliedFiltersRef\.current = false;/);
  });

  it("offers both ways out: change the filters, or clear them", () => {
    const modal = read("components/map/filter-empty-modal.tsx");
    expect(modal).toMatch(/Change filters<\/Button>/);
    expect(modal).toMatch(/Clear filters<\/Button>/);
    expect(screen).toMatch(/onAdjust=\{\(\) => \{ setEmptyPrompt\(false\); setFilterOpen\(true\); \}\}/);
    expect(screen).toMatch(/onReset=\{\(\) => \{ setEmptyPrompt\(false\); setFilters\(EMPTY_FILTERS\); \}\}/);
  });

  it("sits above the map sheet, which would otherwise cover a plain .modal", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.modal\.filter-empty-modal \{ z-index: 970; \}/);
  });
});
