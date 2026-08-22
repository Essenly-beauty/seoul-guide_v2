/** Client-side unified search over the sample data layer. */

import { ARTICLES, PLACES, PRODUCTS, zoneShort, type Article, type Place, type Product } from "./data";
import { searchStations, type SubwayStation } from "./subway";

export type SearchResults = {
  stations: SubwayStation[];
  places: Place[];
  products: Product[];
  articles: Article[];
  total: number;
};

/** How many station hits a query may surface. Stations lead the result list —
    a visitor searching "Gangnam" usually means the area, not one salon — but
    they must never push the place results off the first screen. */
export const STATION_RESULT_LIMIT = 3;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Every query word must appear somewhere in the haystack (AND, substring). */
function matches(haystack: string, query: string): boolean {
  const h = norm(haystack);
  return norm(query).split(" ").every((w) => h.includes(w));
}

// ── Relevance-ranked place search (spec v2 §4.4) ─────────────
// Exact name match → prefix → substring/tag — ties broken by distance, then rating.

import { GANGNAM_STATION, haversineKm, type LatLng } from "./geo";

export type RankedPlace = { place: Place; km: number; score: number };
export type PlaceSearch = { results: RankedPlace[]; similar: RankedPlace[] };

function placeScore(p: Place, q: string): number {
  const name = norm(p.name);
  const kr = norm(p.nameKr);
  if (name === q || kr === q) return 100;
  if (name.startsWith(q) || kr.startsWith(q)) return 80;
  if (name.includes(q) || kr.includes(q)) return 60;
  const hay = [p.tags.join(" "), zoneShort(p.zone), p.type.replace(/_/g, " ")].join(" ");
  if (matches(hay, q)) return 40;
  if (matches([p.name, p.nameKr, hay].join(" "), q)) return 30; // multi-word AND across fields
  return 0;
}

export function rankPlaces(query: string, origin: LatLng = GANGNAM_STATION): PlaceSearch {
  const q = norm(query);
  if (!q) return { results: [], similar: [] };

  const results = PLACES
    .map((place) => ({
      place,
      km: haversineKm(origin, { lat: place.lat, lng: place.lng }),
      score: placeScore(place, q),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.km - b.km || (b.place.rating ?? 0) - (a.place.rating ?? 0));

  // "Similar nearby": same category as the top hit, closest first, excluding direct hits.
  const top = results[0];
  const seen = new Set(results.map((r) => r.place.id));
  const similar = top
    ? PLACES.filter((p) => p.type === top.place.type && !seen.has(p.id))
        .map((place) => ({ place, km: haversineKm(origin, { lat: place.lat, lng: place.lng }), score: 0 }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
    : [];

  return { results, similar };
}

/** First case-insensitive occurrence of `query` in `text` — for bolding the match. */
export function matchRange(text: string, query: string): [number, number] | null {
  const q = norm(query);
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q);
  return i === -1 ? null : [i, i + q.length];
}

export function searchAll(query: string): SearchResults {
  if (!norm(query)) return { stations: [], places: [], products: [], articles: [], total: 0 };

  // Stations were searchable in lib/subway.ts all along but nothing called it,
  // so "show me what's near Gangnam Station" had no entry point anywhere in
  // the app (station-first redesign, phase 1).
  const stations = searchStations(query, STATION_RESULT_LIMIT);

  const places = PLACES.filter((p) =>
    matches([p.name, p.nameKr, p.tags.join(" "), zoneShort(p.zone), p.type].join(" "), query),
  );
  const products = PRODUCTS.filter((p) =>
    matches([p.brand, p.name, p.nameKr, p.category].join(" "), query),
  );
  const articles = ARTICLES.filter((a) => matches([a.title, a.tags.join(" ")].join(" "), query));

  return {
    stations,
    places,
    products,
    articles,
    total: stations.length + places.length + products.length + articles.length,
  };
}
