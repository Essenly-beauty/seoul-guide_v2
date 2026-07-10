import { describe, it, expect } from "vitest";
import { placeStatus, statusLabel, applyFilters, countActiveFilters, EMPTY_FILTERS, type MapFilters } from "./places";
import type { Place } from "./data";

const at = (h: number, m = 0) => new Date(2026, 6, 10, h, m); // local time

describe("placeStatus", () => {
  const hours = { open: "10:00", close: "21:00" };
  it("open within hours", () => expect(placeStatus(hours, at(12))).toBe("open"));
  it("closed before open", () => expect(placeStatus(hours, at(9, 59))).toBe("closed"));
  it("closed at close time", () => expect(placeStatus(hours, at(21))).toBe("closed"));
  it("unknown without hours", () => expect(placeStatus(undefined, at(12))).toBe("unknown"));
});

describe("statusLabel", () => {
  const hours = { open: "10:00", close: "21:00" };
  it("open label", () => expect(statusLabel(hours, at(12))).toBe("Open until 21:00"));
  it("closed label", () => expect(statusLabel(hours, at(22))).toBe("Closed · opens 10:00"));
  it("empty without hours", () => expect(statusLabel(undefined, at(12))).toBe(""));
});

const base: Place = {
  id: "x", name: "X", nameKr: "엑스", type: "hair_salon", zone: "gangnam_station",
  priceRange: "₩₩", tags: [], address: "", lat: 37.5, lng: 127.03,
};

describe("applyFilters", () => {
  const places: Place[] = [
    { ...base, id: "a", type: "hair_salon", rating: 4.5, englishOk: true, bookingChannels: ["naver"], serviceTags: ["perm"] },
    { ...base, id: "b", type: "skin_clinic", rating: 3.9, priceRange: "₩₩₩" },
    { ...base, id: "c", type: "hair_salon", rating: 4.9, priceRange: "₩" },
  ];
  it("category filter", () => {
    expect(applyFilters(places, "hair_salon", EMPTY_FILTERS).map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("all passes everything", () => {
    expect(applyFilters(places, "all", EMPTY_FILTERS)).toHaveLength(3);
  });
  it("minRating4 drops sub-4.0", () => {
    const f: MapFilters = { ...EMPTY_FILTERS, minRating4: true };
    expect(applyFilters(places, "all", f).map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("price multi-select ORs prices, AND with category", () => {
    const f: MapFilters = { ...EMPTY_FILTERS, prices: ["₩", "₩₩₩"] };
    expect(applyFilters(places, "all", f).map((p) => p.id)).toEqual(["b", "c"]);
  });
  it("englishOnly + bookableOnly + serviceTags", () => {
    const f: MapFilters = { ...EMPTY_FILTERS, englishOnly: true, bookableOnly: true, serviceTags: ["perm"] };
    expect(applyFilters(places, "all", f).map((p) => p.id)).toEqual(["a"]);
  });
  it("serviceTags ORs within the list", () => {
    const f: MapFilters = { ...EMPTY_FILTERS, serviceTags: ["perm", "cut"] };
    expect(applyFilters(places, "all", f).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("countActiveFilters", () => {
  it("zero for empty", () => expect(countActiveFilters(EMPTY_FILTERS)).toBe(0));
  it("counts toggles + selected chips", () => {
    const f: MapFilters = { minRating4: true, prices: ["₩", "₩₩"], englishOnly: false, bookableOnly: true, serviceTags: ["perm"] };
    expect(countActiveFilters(f)).toBe(5); // 1 + 2 + 0 + 1 + 1
  });
});
