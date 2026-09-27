import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES, SERVICE_FILTERS, type PlaceType } from "./data";
import { liveServiceFilters } from "./service-filters";

// A filter that matches nothing is worse than no filter: the visitor picks it,
// gets an empty list, and concludes the app has no such store. The sheet was
// offering 20 service filters of which 18 matched nothing — six of them for
// skin_clinic, a category with zero published places — while 65 tax-free and
// 116 SIM-selling Daiso stores had no filter at all.
describe("service filters", () => {
  const types = Object.keys(SERVICE_FILTERS) as PlaceType[];

  it("never offers the visitor a filter that matches nothing", () => {
    const dead: string[] = [];
    for (const type of types) {
      for (const tag of liveServiceFilters(PLACES, type)) {
        if (!PLACES.some((p) => p.type === type && p.serviceTags?.includes(tag.key))) {
          dead.push(`${type}/${tag.key} ("${tag.label}")`);
        }
      }
    }
    expect(dead, dead.join(" | ")).toEqual([]);
  });

  it("keeps a filter the moment the data can answer it", () => {
    // The catalogue is the statement of intent; the live list is what the
    // sheet renders. A tag must not be dropped from the catalogue just
    // because today's data cannot answer it.
    const live = liveServiceFilters(
      [{ type: "daiso", serviceTags: ["tax-refund"] } as never],
      "daiso",
    );
    expect(live.map((t) => t.key)).toEqual(["tax-refund"]);
    expect((SERVICE_FILTERS.daiso ?? []).length).toBeGreaterThan(1);
  });

  it("lets a visitor find the tax-free and SIM-card Daiso stores", () => {
    const keys = liveServiceFilters(PLACES, "daiso").map((t) => t.key);
    expect(keys).toContain("tax-refund");
    expect(keys).toContain("sim-card");
    const daiso = PLACES.filter((p) => p.type === "daiso");
    expect(daiso.filter((p) => p.serviceTags?.includes("tax-refund")).length).toBeGreaterThan(50);
    expect(daiso.filter((p) => p.serviceTags?.includes("sim-card")).length).toBeGreaterThan(100);
  });

  it("shows the official facts on the place sheet, not only in the filter", () => {
    // The facility rows were pulled in the launch audit because they were
    // shared samples invented for every place. The official Daiso store
    // finder is the per-place verified source that comment was waiting for.
    const body = readFileSync(join(import.meta.dirname, "..", "components", "place", "place-detail-body.tsx"), "utf8");
    // Anchored on the call site, not on the identifier: a mutation that
    // deleted the render kept the label table and still matched a bare
    // /serviceTags/, so that assertion could not fail.
    expect(body).toMatch(/<StoreFactsRow place=\{place\} \/>/);
    expect(body).toMatch(/place\.serviceTags \?\? \[\]/);
    expect(body).toMatch(/place\.facilities \?\? \[\]/);
  });

  it("renders the sheet from the live list, not the raw catalogue", () => {
    const sheet = readFileSync(join(import.meta.dirname, "..", "components", "map", "filter-sheet.tsx"), "utf8");
    // Again the call site: the import line alone kept a bare
    // /liveServiceFilters/ green after the usage was reverted.
    expect(sheet).toMatch(/tags: liveServiceFilters\(PLACES, c\)/);
    expect(sheet).not.toMatch(/tags: SERVICE_FILTERS\[c\]/);
  });
});
