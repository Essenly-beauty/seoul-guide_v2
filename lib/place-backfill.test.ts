import { describe, it, expect } from "vitest";
import { PLACES, type DayHours } from "./data";
import { hoursOn, placeStatus } from "./places";
import hoursOverrides from "../scripts/lib/hours-overrides.json";
import krNameOverrides from "../scripts/lib/kr-name-overrides.json";

/** Two fields were backfilled from Kakao Map on 2026-08-23 and both live in
 *  override files that the owning builders re-apply on every rebuild, exactly
 *  like scripts/lib/station-coord-overrides.json:
 *
 *    scripts/lib/hours-overrides.json    ← scripts/backfill-hours.mjs
 *    scripts/lib/kr-name-overrides.json  ← scripts/backfill-kr-names{,-2}.mjs
 *
 *  These tests fail if a pipeline rerun ever drops them again, and — more
 *  importantly — if either backfill ever writes something the UI would show
 *  wrong. `hours` renders as a weekday table labelled "today", and `nameKr` is
 *  what the place sheet hands to a taxi driver, so a plausible but wrong value
 *  is worse than the "HOURS UNKNOWN" / English fallback.
 *
 *  An hours override comes in one of two shapes and never both:
 *    { open, close }  the week is uniform — the original single pair
 *    { week: [...7] } the week varies — Sunday-first, null = closed that day
 *  The second shape is what let the 122 places the first pass refused (the
 *  Olive Young 09:00-weekday / 10:00-weekend split, mostly) be filled without
 *  stating a false opening time. */

type Provenance = { kakaoPlaceId: string; kakaoName: string; openDays: number };
type UniformOverride = Provenance & { open: string; close: string };
type WeekOverride = Provenance & { week: (DayHours | null)[] };
type HoursOverride = UniformOverride | WeekOverride;

const HOURS = Object.entries(hoursOverrides as Record<string, HoursOverride>);
const isWeek = (fix: HoursOverride): fix is WeekOverride => "week" in fix;
const UNIFORM = HOURS.filter((e): e is [string, UniformOverride] => !isWeek(e[1]));
const PER_DAY = HOURS.filter((e): e is [string, WeekOverride] => isWeek(e[1]));
/** Every day either backfill shape claims, flattened for the range checks. */
const ALL_RANGES: [string, DayHours][] = HOURS.flatMap(([id, fix]) =>
  isWeek(fix)
    ? fix.week.flatMap((d) => (d ? [[id, d] as [string, DayHours]] : []))
    : [[id, { open: fix.open, close: fix.close }] as [string, DayHours]],
);

const KR_NAMES = Object.entries(krNameOverrides) as [string, string][];
const BY_ID = new Map(PLACES.map((p) => [p.id, p]));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Kakao writes midnight as "24:00" and so does lib/data.ts (doota-mall), and
 *  placeStatus reads it as minute 1440 — i.e. open right up to midnight. */
const CLOSE_HHMM = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

describe("Kakao opening-hours backfill", () => {
  it("filled a substantial share of the scraped places", () => {
    // 224 on the first run, +21 after the second Korean-name pass unlocked
    // more Kakao lookups, +122 once `week` could hold a non-uniform week.
    // Regressions below 350 mean the loader stopped running or the resolver
    // stopped matching.
    expect(HOURS.length).toBeGreaterThanOrEqual(350); // 364 today
  });

  it("recovered the non-uniform weeks the single-pair model had to skip", () => {
    // Exactly the 122 rows scripts/backfill-hours.mjs used to log as
    // "varies-by-day". They are the reason `week` exists.
    expect(PER_DAY.length).toBeGreaterThanOrEqual(120); // 122 today
    expect(UNIFORM.length).toBeGreaterThanOrEqual(200); // 242 today
    expect(UNIFORM.length + PER_DAY.length).toBe(HOURS.length);
  });

  it("every override names the Kakao place it came from", () => {
    for (const [id, fix] of HOURS) {
      expect(fix.kakaoPlaceId, id).toMatch(/^\d+$/);
      expect(fix.kakaoName.length, id).toBeGreaterThan(0);
    }
  });

  it("carries exactly one of the two shapes — never a pair and a week", () => {
    for (const [id, fix] of HOURS) {
      const hasPair = "open" in fix || "close" in fix;
      expect(isWeek(fix) !== hasPair, `${id} carries both or neither shape`).toBe(true);
    }
  });

  it("every override is a real 24h clock range that opens before it closes", () => {
    for (const [id, range] of ALL_RANGES) {
      expect(range.open, id).toMatch(HHMM);
      expect(range.close, id).toMatch(CLOSE_HHMM);
      // Place.hours has no overnight representation — placeStatus() compares
      // minutes-since-midnight, so open >= close would read as never open.
      expect(toMin(range.close), `${id} ${range.open}–${range.close}`).toBeGreaterThan(toMin(range.open));
    }
  });

  it("only accepts a single pair when the week really is uniform", () => {
    // A pair prints against all seven weekdays, so a place whose Saturday
    // differs must become a `week`, not an average. The backfill records how
    // many days it saw agreeing; anything under 5 should never have been kept
    // as a pair.
    for (const [id, fix] of UNIFORM) {
      expect(fix.openDays, id).toBeGreaterThanOrEqual(5);
      expect(fix.openDays, id).toBeLessThanOrEqual(7);
    }
  });

  it("gives every per-day override a full Sunday-first week", () => {
    // A partial week is the one thing worse than no week: it would silently
    // read as "closed" on the days Kakao simply did not list.
    for (const [id, fix] of PER_DAY) {
      expect(fix.week, id).toHaveLength(7);
      expect(fix.week.filter(Boolean).length, id).toBe(fix.openDays);
      expect(fix.openDays, id).toBeGreaterThan(0);
    }
  });

  it("never stores a week that a single pair could have held", () => {
    // Otherwise the two shapes would drift: the same place could be written
    // either way depending on which branch ran.
    for (const [id, fix] of PER_DAY) {
      const distinct = new Set(fix.week.filter(Boolean).map((d) => `${d!.open}-${d!.close}`));
      const skippable = distinct.size > 1 || fix.openDays < 5;
      expect(skippable, `${id} is uniform and should be a single pair`).toBe(true);
    }
  });

  it("targets a place that still exists after a rebuild", () => {
    for (const [id] of HOURS) expect(BY_ID.has(id), `${id} has no place`).toBe(true);
  });

  it("serves the backfilled hours from PLACES, not the pre-backfill blank", () => {
    for (const [id, fix] of HOURS) {
      const place = BY_ID.get(id)!;
      expect(place.hours, id).toBeDefined();
      const want = isWeek(fix) ? fix.week : Array(7).fill({ open: fix.open, close: fix.close });
      for (let day = 0; day < 7; day++) {
        expect(hoursOn(place.hours, day), `${id} day ${day}`).toEqual(want[day]);
      }
    }
  });

  it("shows a weekday-vs-weekend place its real hours on each side", () => {
    // 올리브영 학동중앙점 is the canonical case the first pass refused:
    // 09:00 Mon–Fri, 10:00 Sat/Sun. Anything that flattens it back to one pair
    // states a false opening time on two days out of seven.
    const oy = BY_ID.get("oy-학동중앙점")!;
    expect(hoursOn(oy.hours, 1)).toEqual({ open: "09:00", close: "22:30" }); // Monday
    expect(hoursOn(oy.hours, 0)).toEqual({ open: "10:00", close: "22:30" }); // Sunday
    expect(hoursOn(oy.hours, 6)).toEqual({ open: "10:00", close: "22:30" }); // Saturday
    // Aug 2026's weeks start on the 23rd, a Sunday.
    expect(placeStatus(oy.hours, new Date(2026, 7, 24, 9, 30))).toBe("open");   // Mon 09:30
    expect(placeStatus(oy.hours, new Date(2026, 7, 23, 9, 30))).toBe("closed"); // Sun 09:30
  });

  it("turned 'HOURS UNKNOWN' into a real status for most of the catalogue", () => {
    const known = PLACES.filter((p) => p.hours).length;
    expect(known / PLACES.length).toBeGreaterThan(0.6); // 408/600 today
  });

  it("reports open/closed rather than unknown for every backfilled place", () => {
    const noon = new Date(2026, 7, 24, 12, 0);
    for (const [id] of HOURS) {
      expect(placeStatus(BY_ID.get(id)!.hours, noon), id).not.toBe("unknown");
    }
  });

  it("never sources two of our places from one Kakao place", () => {
    // One storefront cannot be two shops, so a shared Kakao id means at most
    // one row is genuine and the others are wearing a neighbour's hours — all
    // three "JUNO HAIR | Myeongdong …" rows resolved to 준오헤어 명동4호점.
    // The backfill withdraws every claimant instead of guessing.
    const byKakaoId = new Map<string, string[]>();
    for (const [id, fix] of HOURS) {
      byKakaoId.set(fix.kakaoPlaceId, [...(byKakaoId.get(fix.kakaoPlaceId) ?? []), id]);
    }
    expect([...byKakaoId.entries()].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });

  it("leaves places without an override showing no hours at all", () => {
    // Honesty check: the backfill must never have invented a pair for a place
    // it could not resolve. Everything with hours is either an override or one
    // of the 44 hand-curated rows in lib/data.ts.
    const overridden = new Set(HOURS.map(([id]) => id));
    const curated = PLACES.filter((p) => p.hours && !overridden.has(p.id));
    expect(curated.every((p) => p.source === "curated" || p.source === undefined)).toBe(true);
  });
});

describe("Kakao Korean-name backfill", () => {
  it("kept the first pass's matches and added the second pass's", () => {
    // 68 from scripts/backfill-kr-names.mjs, +26 from the widened second pass
    // (scripts/backfill-kr-names-2.mjs — see scripts/kr-name-pass2-report.md
    // for the ones it deliberately left in English), minus the 3 the contested
    // sweep withdrew because the first pass had given them a shared name.
    expect(KR_NAMES.length).toBeGreaterThanOrEqual(91);
  });

  it("every override is actually Korean — that is the entire point", () => {
    for (const [id, kr] of KR_NAMES) {
      expect(/[가-힣]/.test(kr), `${id} = "${kr}"`).toBe(true);
    }
  });

  it("targets a place that still exists after a rebuild", () => {
    for (const [id] of KR_NAMES) expect(BY_ID.has(id), `${id} has no place`).toBe(true);
  });

  it("serves the Korean name from PLACES, not the English fallback", () => {
    for (const [id, kr] of KR_NAMES) {
      expect(BY_ID.get(id)!.nameKr, id).toBe(kr);
    }
  });

  it("never hands two different places the same Korean name", () => {
    // A contested name means at least one of them is a neighbour that scored
    // well — the second pass demotes those to its review report instead of
    // guessing, and this fails if that guard is ever removed.
    const byName = new Map<string, string[]>();
    for (const [id, kr] of KR_NAMES) byName.set(kr, [...(byName.get(kr) ?? []), id]);
    const contested = [...byName.entries()].filter(([, ids]) => ids.length > 1);
    expect(contested).toEqual([]);
  });

  it("leaves the still-unmatched rows in English rather than guessing", () => {
    const english = PLACES.filter((p) => p.source === "creatrip" && !/[가-힣]/.test(p.nameKr));
    // 137 before the second pass, 111 after. This asserts the direction of
    // travel without pretending the remainder is solved.
    expect(english.length).toBeLessThanOrEqual(115);
    expect(english.length).toBeGreaterThan(0);
  });
});

describe("English-first titles", () => {
  it("leaves no Korean in the English name field", async () => {
    const { PLACES } = await import("@/lib/data");
    // 239 Olive Young rows carried "Olive Young 학동중앙점". The app is
    // English-first for visitors (owner decision 2026-08-23); the Korean
    // lives in nameKr.
    const mixed = PLACES.filter((p) => /[가-힣]/.test(p.name));
    expect(mixed.map((p) => p.id)).toEqual([]);
  });

  it("keeps the Korean name so the taxi card still works", async () => {
    const { getPlace } = await import("@/lib/data");
    const p = getPlace("oy-학동중앙점");
    expect(p?.name).toBe("Olive Young Hakdongjungang");
    expect(p?.nameKr).toMatch(/[가-힣]/);
  });

  it("romanizes station and office suffixes into English words", async () => {
    const { englishizeName } = await import("../scripts/lib/hangul-romanize.mjs");
    expect(englishizeName("Olive Young 청담역점")).toBe("Olive Young Cheongdam Stn.");
    expect(englishizeName("Olive Young 강남구청점")).toBe("Olive Young Gangnam-gu Office");
    expect(englishizeName("Already English")).toBe("Already English");
  });
});
