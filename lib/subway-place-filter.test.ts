import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Place, PlaceType } from "./data";
import { filterSubwayPlaces } from "./subway-place-filter";

function place(id: string, type: PlaceType): Place {
  return {
    id,
    name: id,
    nameKr: id,
    type,
    zone: "gangnam_station",
    priceRange: "₩",
    tags: [],
    address: "Seoul",
    lat: 37.5,
    lng: 127,
  };
}

const places = [
  place("clinic", "skin_clinic"),
  place("salon", "hair_salon"),
  place("nails", "nail_lash"),
  place("color", "personal_color"),
  place("spa", "head_spa"),
  place("olive", "olive_young"),
  place("daiso", "daiso"),
  place("mall", "mall"),
  place("other", "etc"),
];

describe("filterSubwayPlaces", () => {
  it("returns every nearby place for All without mutating the input", () => {
    const result = filterSubwayPlaces(places, "all");

    expect(result).toEqual(places);
    expect(result).not.toBe(places);
  });

  it.each([
    ["daiso", "daiso", "daiso"],
    ["olive_young", "olive_young", "olive"],
    ["personal_color", "personal_color", "color"],
    ["mall", "mall", "mall"],
  ] as const)("returns only %s places for the exact category", (category, type, id) => {
    const result = filterSubwayPlaces(places, category);

    expect(result.map((item) => item.id)).toEqual([id]);
    expect(result.every((item) => item.type === type)).toBe(true);
  });

  it("keeps service beauty places and excludes retail, miscellaneous, and mall places", () => {
    const result = filterSubwayPlaces(places, "beauty");

    expect(result.map((item) => item.type)).toEqual([
      "skin_clinic",
      "hair_salon",
      "nail_lash",
      "personal_color",
      "head_spa",
    ]);
    expect(result.some((item) => item.type === "daiso")).toBe(false);
    expect(result.some((item) => item.type === "olive_young")).toBe(false);
    expect(result.some((item) => item.type === "etc")).toBe(false);
    expect(result.some((item) => item.type === "mall")).toBe(false);
  });
});

describe("subway Daiso empty state", () => {
  const controllerSource = readFileSync(
    new URL("../components/subway/subway-route-controller.tsx", import.meta.url),
    "utf8",
  );

  it("describes an empty nearby result without claiming Daiso data is disconnected", () => {
    expect(controllerSource).not.toContain("Daiso location data is not connected yet");
    expect(controllerSource).toContain('daiso: "Daiso stores"');
    expect(controllerSource).toContain("EMPTY_CATEGORY_LABEL[category]");
  });
});

describe("subway place-filter wiring", () => {
  const mapScreenSource = readFileSync(
    new URL("../components/map/map-screen.tsx", import.meta.url),
    "utf8",
  );

  it("routes station results through the shared filter instead of an inline Daiso-empty branch", () => {
    expect(mapScreenSource).toContain(
      'import { filterSubwayPlaces, type SubwayPlaceCategory } from "@/lib/subway-place-filter"',
    );
    expect(mapScreenSource).toContain("return filterSubwayPlaces(nearby, stationCategory)");
    expect(mapScreenSource).not.toContain('stationCategory === "daiso"');
  });
});
