/** Pure place logic: open-hours status + map filter application. */

import type { Place, PlaceType, PriceRange } from "./data";
import { haversineKm } from "./geo";

export type PlaceStatus = "open" | "closed" | "unknown";

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function placeStatus(hours: Place["hours"], now: Date = new Date()): PlaceStatus {
  if (!hours) return "unknown";
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= toMin(hours.open) && cur < toMin(hours.close) ? "open" : "closed";
}

export function statusLabel(hours: Place["hours"], now: Date = new Date()): string {
  const s = placeStatus(hours, now);
  if (s === "unknown" || !hours) return "";
  return s === "open" ? `Open until ${hours.close}` : `Closed · opens ${hours.open}`;
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
    if (f.prices.length > 0 && !f.prices.includes(p.priceRange)) return false;
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
