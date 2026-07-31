// Build lib/generated/oliveyoung-places.ts from the Kakao Map store capture.
//
//   node scripts/build-oliveyoung-kakao.mjs
//
// Input: scripts/.kakao-oy-stores.json — [{name, addr, score}] captured from
// Kakao Map's public search results ("서울 {구} 올리브영", 25 districts).
// This REPLACES the OSM-based build-oliveyoung-places.mjs output (same export)
// with Kakao's fuller store network; the OSM script remains as a fallback if
// the capture can't be refreshed. Geocoding is Nominatim with an on-disk
// cache; rows whose address won't resolve fall back to their 구's centroid.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STORES_PATH = join(ROOT, "scripts", ".kakao-oy-stores.json");
const CACHE_PATH = join(ROOT, "scripts", ".oliveyoung-geocode-cache.json");
const OUT_PATH = join(ROOT, "lib", "generated", "oliveyoung-places.ts");

// ── Geocoding (same pattern as the other importers) ────────
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

async function nominatim(query) {
  const wait = lastRequestAt + 1150 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": "essenly-prototype-data-import/0.1" } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = await res.json();
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

function addressVariants(raw) {
  const base = raw.replace(/\s+/g, " ").trim();
  const noFloor = base.replace(/\s+(B?\d+F|지하\s*\d*층?|\d+층|\d+호|[\d,~\-]+층)\b.*$/iu, "").trim();
  const spaced = noFloor
    .replace(/([가-힣]+로)\s+(\d+번?길)/g, "$1$2")
    .replace(/(번?길)(\d)/g, "$1 $2");
  const houseOnly = (spaced.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?:\s|$)/) ?? [])[1];
  return [...new Set([houseOnly, spaced, noFloor].filter(Boolean))];
}

async function geocode(addr) {
  if (addr in cache) return cache[addr];
  let hit = null;
  for (const variant of addressVariants(addr)) {
    hit = await nominatim(variant);
    if (hit) { hit = { ...hit, variant }; break; }
  }
  cache[addr] = hit;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
  return hit;
}

const districtCache = {};
async function districtCenter(addr) {
  const gu = (addr.match(/([가-힣]{1,6}구)(?=\s|$)/) ?? [])[1];
  if (!gu) return null;
  if (!(gu in districtCache)) districtCache[gu] = await nominatim(`서울특별시 ${gu}`);
  return districtCache[gu];
}

// ── Zone assignment (same centroids as the other importers) ──
const ZONE_CENTROIDS = {
  myeongdong: { lat: 37.5637, lng: 126.9847 }, hongdae: { lat: 37.553, lng: 126.922 },
  gangnam_station: { lat: 37.4995, lng: 127.028 }, apgujeong: { lat: 37.527, lng: 127.03 },
  cheongdam: { lat: 37.525, lng: 127.048 }, sinsa: { lat: 37.516, lng: 127.02 },
  seongsu: { lat: 37.544, lng: 127.056 }, samsung: { lat: 37.509, lng: 127.063 },
  jongno: { lat: 37.575, lng: 126.983 }, hannam: { lat: 37.534, lng: 127.002 },
  itaewon: { lat: 37.534, lng: 126.994 },
  jamsil: { lat: 37.513, lng: 127.1 }, yeongdeungpo: { lat: 37.519, lng: 126.915 },
};
const km = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};
function nearestZone(coord) {
  let best = "seoul_etc", bestKm = Infinity;
  for (const [zone, c] of Object.entries(ZONE_CENTROIDS)) {
    const d = km(coord, c);
    if (d < bestKm) { best = zone; bestKm = d; }
  }
  return bestKm <= 4 ? best : "seoul_etc";
}
const SEOUL = { latMin: 37.42, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 };
const inSeoul = (p) => p.lat >= SEOUL.latMin && p.lat <= SEOUL.latMax && p.lng >= SEOUL.lngMin && p.lng <= SEOUL.lngMax;

// Curated Olive Young samples in lib/data.ts — drop Kakao twins nearby.
const CURATED = [
  { id: "oy-gangnam-town", lat: 37.5006, lng: 127.0266, kr: "올리브영 강남타운점" },
  { id: "oy-gangnam-stn", lat: 37.4972, lng: 127.0287, kr: "올리브영 강남역점" },
  { id: "oy-myeongdong", lat: 37.5637, lng: 126.9847, kr: "올리브영 명동타운점" },
  { id: "oy-hongdae", lat: 37.5563, lng: 126.9236, kr: "올리브영 홍대중앙점" },
  { id: "oy-seongsu", lat: 37.5444, lng: 127.0561, kr: "올리브영 성수역점" },
  { id: "oy-itaewon", lat: 37.5346, lng: 126.9942, kr: "올리브영 이태원점" },
];
const normName = (s) => s.replace(/[^가-힣a-z0-9]/gi, "").replace(/점$/, "");

// ── Main ───────────────────────────────────────────────────
const raw = JSON.parse(readFileSync(STORES_PATH, "utf8"));
// Kakao fuzzy-matches similar brands ("올리브베러") — this import is Olive Young
// stores only; the corporate HQ ("본사") is an office, not a shop.
const stores = raw.filter((s) => s.name.includes("올리브영") && !s.name.includes("본사"));
console.log(`kakao stores: ${stores.length} (filtered out ${raw.length - stores.length} non-올리브영 brand rows)`);

let addressHits = 0, areaFallbacks = 0, curatedDropped = 0;
const taken = new Set();
const places = [];
let i = 0;
for (const s of stores) {
  i++;
  if (CURATED.some((c) => normName(c.kr) === normName(s.name))) { curatedDropped++; continue; }
  let geo = null;
  try {
    const hit = await geocode(s.addr);
    if (hit && inSeoul(hit)) geo = { lat: hit.lat, lng: hit.lng, geoSource: "address" };
  } catch (e) {
    console.error(`geocode error (${s.name}): ${e.message}`);
  }
  if (geo && CURATED.some((c) => km(c, geo) < 0.12)) { curatedDropped++; continue; }
  if (!geo) {
    const base = (await districtCenter(s.addr)) ?? { lat: 37.5665, lng: 126.978 };
    geo = {
      lat: base.lat + Math.sin(i * 2.4) * 0.0028,
      lng: base.lng + Math.cos(i * 2.4) * 0.0034,
      geoSource: "area",
    };
    areaFallbacks++;
  } else addressHits++;

  const branch = s.name.replace(/올리브영/g, "").trim();
  let base = ("oy-" + (branch || "seoul").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 48);
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  const rating = s.score ? Number(s.score) : undefined;
  const reviews = s.reviews ? Number(String(s.reviews).replace(/[^0-9]/g, "")) : undefined;

  places.push({
    id,
    name: branch ? `Olive Young ${branch}` : "Olive Young",
    nameKr: s.name,
    type: "olive_young",
    zone: nearestZone(geo),
    priceRange: "₩",
    ...(rating ? { rating } : {}),
    ...(reviews ? { ratingCount: reviews } : {}),
    tags: ["k-beauty"],
    address: s.addr,
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    geoSource: geo.geoSource,
  });
  if (i % 25 === 0) console.log(`geocoded ${i}/${stores.length}…`);
}

// Same-complex stores (e.g. Lotte World vs Lotte Dept. Jamsil) can geocode to
// one building point — nudge the later one ~25m per step so both stay tappable.
for (let a = 1; a < places.length; a++) {
  const p = places[a];
  if (p.geoSource !== "address") continue;
  let bump = 0;
  while (
    places.slice(0, a).some((q) => q.geoSource === "address" && Math.abs(q.lat - p.lat) < 0.00015 && Math.abs(q.lng - p.lng) < 0.00018)
    && bump < 8
  ) {
    p.lat = Number((p.lat + 0.00022).toFixed(6));
    p.lng = Number((p.lng + 0.00012).toFixed(6));
    bump++;
  }
}


mkdirSync(dirname(OUT_PATH), { recursive: true });
const header = `// AUTO-GENERATED by scripts/build-oliveyoung-kakao.mjs — do not edit by hand.
// Source: Kakao Map public search capture (${places.length} Seoul stores;
// ${addressHits} address-geocoded, ${areaFallbacks} district-level fallbacks, ${curatedDropped} curated twins dropped).

import type { Place } from "../data";

export const OLIVEYOUNG_PLACES: Place[] = `;
writeFileSync(OUT_PATH, header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n");

console.log(`\nwrote ${OUT_PATH}`);
console.log(`stores: ${places.length} (address ${addressHits}, area ${areaFallbacks}, curated-dropped ${curatedDropped})`);
const byZone = {};
for (const p of places) byZone[p.zone] = (byZone[p.zone] ?? 0) + 1;
console.log("zones:", Object.entries(byZone).sort((a, b) => b[1] - a[1]).map(([z, c]) => `${z}:${c}`).join(" "));
