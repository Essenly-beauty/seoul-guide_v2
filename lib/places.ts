/** Pure place logic: open-hours status + map filter application. */

import type { DayHours, Place, PlaceType, PriceRange } from "./data";
import { haversineKm } from "./geo";

export type PlaceStatus = "open" | "closed" | "unknown";

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Sunday-first, matching Date#getDay() and the detail page's weekday table. */
const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** True when this place keeps a different schedule on different days. Callers
    that only want "is it open now" never need to ask — `placeStatus` and
    `statusLabel` resolve the day themselves. */
export function hasPerDayHours(hours: Place["hours"]): boolean {
  return !!hours && "week" in hours;
}

/**
 * The opening range for one weekday (0 = Sunday), or null when the place is
 * closed that day. This is the single place weekday branching lives: a uniform
 * pair answers the same for all seven, a per-day week answers from its row.
 */
export function hoursOn(hours: Place["hours"], day: number): DayHours | null {
  if (!hours) return null;
  if ("week" in hours) return hours.week[((day % 7) + 7) % 7] ?? null;
  return hours;
}

/** `hoursOn` for the day `now` falls on — the visitor's local day. */
export function hoursToday(hours: Place["hours"], now: Date = new Date()): DayHours | null {
  return hoursOn(hours, now.getDay());
}

/** The next moment the place opens, starting from `now`. Null when it never
    opens (an all-closed week), which the backfill never writes. */
function nextOpening(hours: Place["hours"], now: Date): { day: number; open: string } | null {
  const cur = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 7; i++) {
    const day = (now.getDay() + i) % 7;
    const h = hoursOn(hours, day);
    if (!h) continue;
    if (i === 0 && cur >= toMin(h.open)) continue; // today's opening already went by
    return { day, open: h.open };
  }
  return null;
}

export function placeStatus(hours: Place["hours"], now: Date = new Date()): PlaceStatus {
  if (!hours) return "unknown";
  const today = hoursToday(hours, now);
  if (!today) return "closed"; // a day the place is shut is closed, not unknown
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= toMin(today.open) && cur < toMin(today.close) ? "open" : "closed";
}

export function statusLabel(hours: Place["hours"], now: Date = new Date()): string {
  if (!hours) return "Hours unknown";
  const today = hoursToday(hours, now);
  if (placeStatus(hours, now) === "open") return `Open until ${today!.close}`;
  const next = nextOpening(hours, now);
  if (!next) return "Closed";
  // Name the day only when the week actually varies. For a place that keeps the
  // same hours daily, "opens 10:00" is already unambiguous; for one that opens
  // 09:00 on weekdays, "opens 10:00" on a Friday night would be a wrong fact.
  const needsDay = hasPerDayHours(hours) && next.day !== now.getDay();
  return `Closed · opens ${needsDay ? `${DAY_ABBR[next.day]} ` : ""}${next.open}`;
}

export type MapFilters = {
  minRating4: boolean;
  prices: PriceRange[];
  englishOnly: boolean;
  bookableOnly: boolean;
  serviceTags: string[];
  /** Straight-line km from the user's position (fallback: Gangnam Stn); null = any. */
  maxKm?: number | null;
};

export const EMPTY_FILTERS: MapFilters = {
  minRating4: false, prices: [], englishOnly: false, bookableOnly: false, serviceTags: [], maxKm: null,
};

export function countActiveFilters(f: MapFilters): number {
  return (f.minRating4 ? 1 : 0) + f.prices.length + (f.englishOnly ? 1 : 0) +
    (f.bookableOnly ? 1 : 0) + f.serviceTags.length + (f.maxKm != null ? 1 : 0);
}

export function applyFilters(
  places: Place[],
  cat: "all" | PlaceType | PlaceType[],
  f: MapFilters,
  origin?: { lat: number; lng: number },
): Place[] {
  // Array form = multi-select chips (empty array means no category filter).
  const cats = Array.isArray(cat) ? cat : cat === "all" ? [] : [cat];
  return places.filter((p) => {
    if (cats.length > 0 && !cats.includes(p.type)) return false;
    if (f.minRating4 && (p.rating ?? 0) < 4.0) return false;
    if (f.prices.length > 0 && (!p.priceRange || !f.prices.includes(p.priceRange))) return false;
    if (f.englishOnly && !p.englishOk) return false;
    if (f.bookableOnly && (p.bookingChannels?.length ?? 0) === 0) return false;
    if (f.serviceTags.length > 0 && !f.serviceTags.some((t) => p.serviceTags?.includes(t))) return false;
    if (f.maxKm != null && origin && haversineKm(origin, p) > f.maxKm) return false;
    return true;
  });
}

export function isBookable(place: Place): boolean {
  return (place.bookingChannels?.length ?? 0) > 0;
}
