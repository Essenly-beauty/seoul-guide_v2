import { describe, it, expect } from "vitest";
import {
  placeStatus, statusLabel, hoursOn, hoursToday, hasPerDayHours,
  applyFilters, countActiveFilters, EMPTY_FILTERS, type MapFilters,
} from "./places";
import type { Place, PlaceHours } from "./data";

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
  it("names the unknown-hours state", () => expect(statusLabel(undefined, at(12))).toBe("Hours unknown"));
});

// ── per-day weeks ───────────────────────────────────────────
// Aug 2026 starts its weeks on the 23rd — the same Sunday-first week the Kakao
// panels were captured on, so `on(0, …)` really is a Sunday.
const on = (day: number, h: number, m = 0) => new Date(2026, 7, 23 + day, h, m);

/** 올리브영 학동중앙점, the exact shape 122 backfilled rows have: 09:00 on
 *  weekdays, 10:00 at weekends. Flattening this to one pair is what the model
 *  change exists to stop. */
const OLIVE_YOUNG: PlaceHours = {
  week: [
    { open: "10:00", close: "22:30" }, // Sun
    ...Array.from({ length: 5 }, () => ({ open: "09:00", close: "22:30" })), // Mon–Fri
    { open: "10:00", close: "22:30" }, // Sat
  ],
};
/** CHOP헤어 분당점 — closed Tuesdays, and a later Saturday open. */
const CLOSED_TUESDAYS: PlaceHours = {
  week: [
    { open: "10:30", close: "20:00" }, // Sun
    { open: "10:30", close: "20:00" }, // Mon
    null,                              // Tue — shut
    { open: "10:30", close: "20:00" },
    { open: "10:30", close: "20:00" },
    { open: "10:30", close: "20:00" },
    { open: "10:00", close: "20:00" }, // Sat
  ],
};

describe("sanity: the fixture week really is Sunday-first", () => {
  it.each([0, 1, 2, 3, 4, 5, 6])("day offset %i maps to getDay() %i", (d) => {
    expect(on(d, 12).getDay()).toBe(d);
  });
});

describe("hoursOn", () => {
  it("answers the same pair for every day of a uniform week", () => {
    const uniform = { open: "10:00", close: "21:00" };
    for (let d = 0; d < 7; d++) expect(hoursOn(uniform, d)).toEqual(uniform);
  });

  it("answers each day from its own row of a per-day week", () => {
    expect(hoursOn(OLIVE_YOUNG, 0)).toEqual({ open: "10:00", close: "22:30" }); // Sunday
    expect(hoursOn(OLIVE_YOUNG, 1)).toEqual({ open: "09:00", close: "22:30" }); // Monday
    expect(hoursOn(OLIVE_YOUNG, 6)).toEqual({ open: "10:00", close: "22:30" }); // Saturday
  });

  it("returns null for a day the place is shut, never a neighbouring day's time", () => {
    expect(hoursOn(CLOSED_TUESDAYS, 2)).toBeNull();
  });

  it("returns null when the place has no hours at all", () => {
    expect(hoursOn(undefined, 3)).toBeNull();
  });

  it("resolves today against the supplied clock", () => {
    expect(hoursToday(OLIVE_YOUNG, on(6, 12))).toEqual({ open: "10:00", close: "22:30" });
    expect(hoursToday(OLIVE_YOUNG, on(3, 12))).toEqual({ open: "09:00", close: "22:30" });
  });

  it("tells a per-day week from a legacy pair", () => {
    expect(hasPerDayHours(OLIVE_YOUNG)).toBe(true);
    expect(hasPerDayHours({ open: "10:00", close: "21:00" })).toBe(false);
    expect(hasPerDayHours(undefined)).toBe(false);
  });
});

describe("placeStatus on a week that is not uniform", () => {
  // 09:30 is the whole point: open on a weekday, still shut at the weekend.
  it("is open at 09:30 on a Monday", () => expect(placeStatus(OLIVE_YOUNG, on(1, 9, 30))).toBe("open"));
  it("is closed at 09:30 on a Sunday", () => expect(placeStatus(OLIVE_YOUNG, on(0, 9, 30))).toBe("closed"));
  it("is closed at 09:30 on a Saturday", () => expect(placeStatus(OLIVE_YOUNG, on(6, 9, 30))).toBe("closed"));
  it("is open at 10:30 on a Sunday", () => expect(placeStatus(OLIVE_YOUNG, on(0, 10, 30))).toBe("open"));

  it("reports a shut day as closed, not unknown", () => {
    expect(placeStatus(CLOSED_TUESDAYS, on(2, 12))).toBe("closed");
    expect(placeStatus(CLOSED_TUESDAYS, on(3, 12))).toBe("open");
  });
});

describe("statusLabel on a week that is not uniform", () => {
  it("counts down to the day's own closing time", () => {
    expect(statusLabel(OLIVE_YOUNG, on(1, 12))).toBe("Open until 22:30");
  });

  it("gives the weekend its own opening time", () => {
    expect(statusLabel(OLIVE_YOUNG, on(0, 9, 30))).toBe("Closed · opens 10:00");
    expect(statusLabel(OLIVE_YOUNG, on(1, 8, 30))).toBe("Closed · opens 09:00");
  });

  it("names the day once the next opening is not today", () => {
    // Friday night: the next opening is Saturday's 10:00, not Friday's 09:00.
    expect(statusLabel(OLIVE_YOUNG, on(5, 23))).toBe("Closed · opens Sat 10:00");
    // Saturday night rolls to Sunday, which also opens at 10:00 — still named,
    // because on a varying week the bare time would not say which day.
    expect(statusLabel(OLIVE_YOUNG, on(6, 23))).toBe("Closed · opens Sun 10:00");
  });

  it("skips over a shut day to the next one that opens", () => {
    expect(statusLabel(CLOSED_TUESDAYS, on(2, 12))).toBe("Closed · opens Wed 10:30");
    expect(statusLabel(CLOSED_TUESDAYS, on(1, 21))).toBe("Closed · opens Wed 10:30");
  });

  it("leaves a legacy uniform pair's label untouched — no day prefix to add", () => {
    const uniform = { open: "10:00", close: "21:00" };
    expect(statusLabel(uniform, on(5, 23))).toBe("Closed · opens 10:00");
    expect(statusLabel(uniform, on(0, 12))).toBe("Open until 21:00");
  });

  it("says plainly that a never-open week is closed rather than inventing a time", () => {
    expect(statusLabel({ week: Array(7).fill(null) }, on(0, 12))).toBe("Closed");
  });
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
