// Build lib/generated/oliveyoung-places.ts from Olive Young's OWN store finder.
//
//   node scripts/build-oliveyoung-official.mjs
//
// Replaces scripts/build-oliveyoung-kakao.mjs, which read a Kakao Map public
// search capture. A map search returns what it indexes and caps what it hands
// back: that capture held 249 rows where Olive Young's own roster holds 366,
// so the app was missing 138 Seoul stores (38%), including every Hongdae
// branch, both Gangnam Towns, Garosu-gil, COEX Mall and both Gimpo Airport
// stores. See docs/research/store-data-accuracy-2026-09-23.md.
//
// Input:  data/sources/oliveyoung-seoul-2026-09-23.json
// Output: lib/generated/oliveyoung-places.ts
//
// IDS ARE LOAD-BEARING. Supabase stores place_id in favorites, ratings and
// shared_lists, so an id that changes silently drops a user's saved place.
// Every store already in the generated file keeps its existing id; only
// genuinely new stores get a new one.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyHoursOverrides } from "./lib/generated-places.mjs";
import { englishizeName } from "./lib/hangul-romanize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = join(ROOT, "data", "sources", "oliveyoung-seoul-2026-09-23.json");
const CACHE_PATH = join(ROOT, "scripts", ".oliveyoung-geocode-cache.json");
const OUT_PATH = join(ROOT, "lib", "generated", "oliveyoung-places.ts");
const PREVIOUS_PATH = OUT_PATH;

// ── Geocoding ──────────────────────────────────────────────
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

/** The Kakao capture wrote "서울 …", the store finder writes "서울특별시 …".
    Normalising the cache key lets a rebuild reuse the 163 coordinates the
    previous import already paid Nominatim for. */
function cacheKey(addr) {
  return addr
    .replace(/서울특별시/g, "서울")
    .replace(/\s+(B?\d+F|지하\s*\d*층?|\d+층|\d+호|[\d,~\-]+층).*$/iu, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const normalisedCache = {};
for (const [k, v] of Object.entries(cache)) normalisedCache[cacheKey(k)] = v;

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
  const base = raw.replace(/서울특별시/g, "서울").replace(/\s+/g, " ").trim();
  const noFloor = base.replace(/\s+(B?\d+F|지하\s*\d*층?|\d+층|\d+호|[\d,~\-]+층)\b.*$/iu, "").trim();
  const spaced = noFloor
    .replace(/([가-힣]+로)\s+(\d+번?길)/g, "$1$2")
    .replace(/(번?길)(\d)/g, "$1 $2");
  const houseOnly = (spaced.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?:\s|$)/) ?? [])[1];
  // The store finder writes the building after a comma ("망우로 78, 휘경빌딩
  // 1층"), sometimes runs the number onto the road ("신내로72"), and uses
  // sub-road forms the road-plus-number pattern misses ("보라매로 5가길 16").
  // Each of those defeated every variant above and cost a real pin.
  const beforeComma = base.split(",")[0].trim();
  const numberSplit = beforeComma.replace(/([가-힣]+(?:로|길))(\d)/g, "$1 $2");
  const roadOnly = (numberSplit.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?)/) ?? [])[1];
  return [...new Set([houseOnly, roadOnly, numberSplit, spaced, noFloor, beforeComma].filter(Boolean))];
}

async function geocode(addr) {
  const key = cacheKey(addr);
  if (key in normalisedCache) return normalisedCache[key];
  let hit = null;
  for (const variant of addressVariants(addr)) {
    hit = await nominatim(variant);
    if (hit) { hit = { ...hit, variant }; break; }
  }
  normalisedCache[key] = hit;
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

// ── Zones ──────────────────────────────────────────────────
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

// The previous build dropped any store within 120m of one of six curated
// Olive Young samples in lib/data.ts. That rule now costs far more than it
// saves: those six are unpublished demo records that were never promoted for
// publication, and the radius was deleting genuinely different shops. It took
// out 올리브영 홍대 타운, 홍대입구역점, 명동점, 이태원중앙점 and 9 more, all real
// branches a visitor can walk into. Two of the six samples (올리브영 홍대중앙점,
// 올리브영 이태원점) are not on the roster at all.
//
// The roster is the source of truth, so nothing is dropped for sitting near a
// private sample.
const normName = (s) => s.replace(/올리브영|올리브베러/g, "").replace(/[^가-힣a-z0-9]/gi, "").replace(/점$/, "");

// ── Existing ids — the whole point of this step ────────────
const previous = existsSync(PREVIOUS_PATH) ? readFileSync(PREVIOUS_PATH, "utf8") : "";
const previousById = new Map();
for (const m of previous.matchAll(/id: "([^"]+)",\s*\n\s*name: "([^"]*)",\s*\n\s*nameKr: "([^"]*)"/g)) {
  previousById.set(normName(m[3]), { id: m[1], nameKr: m[3] });
}
const previousRatings = new Map();
for (const m of previous.matchAll(/nameKr: "([^"]*)",[\s\S]{0,400}?rating: ([\d.]+),\s*\n\s*ratingCount: (\d+)/g)) {
  previousRatings.set(normName(m[1]), { rating: Number(m[2]), ratingCount: Number(m[3]) });
}
console.log(`previous generated file: ${previousById.size} stores, ${previousRatings.size} with a rating`);

// ── Main ───────────────────────────────────────────────────
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
const stores = snapshot.stores.filter((s) => /^서울/.test(s.addr));
console.log(`official Seoul stores: ${stores.length} (snapshot ${snapshot.retrievedAt})`);

/** The finder prints "학동중앙점" for most branches and "올리브영 명동 타운" for
    the flagships. The app's nameKr has always carried the chain word.
 *
 *  올리브베러 is a separate Olive Young format with its own sign, so prefixing
 *  it produced "올리브영 올리브베러 광화문점" — a name no shop carries — and an
 *  English title the romaniser then mangled to "Olribeubereo". */
const OWN_BRAND = /^(올리브영|올리브베러)/;
const displayKr = (name) => (OWN_BRAND.test(name) ? name : `올리브영 ${name}`).replace(/\s+/g, " ").trim();

/** "수 10:00~22:30" — the finder shows the hours for the day of capture only. */
function captureHours(time) {
  const m = /(\d{2}):(\d{2})~(\d{2}):(\d{2})/.exec(time ?? "");
  if (!m) return undefined;
  const open = `${m[1]}:${m[2]}`;
  let close = `${m[3]}:${m[4]}`;
  if (close === "00:00") close = "24:00";
  return open === close ? undefined : { open, close };
}

let reused = 0, fresh = 0, addressHits = 0, areaFallbacks = 0, cacheHits = 0;
const taken = new Set();
const places = [];
let i = 0;
for (const s of stores) {
  i++;
  const kr = displayKr(s.name);
  const nn = normName(kr);

  const cached = cacheKey(s.addr) in normalisedCache;
  let geo = null;
  try {
    const hit = await geocode(s.addr);
    if (cached) cacheHits++;
    if (hit && inSeoul(hit)) geo = { lat: hit.lat, lng: hit.lng, geoSource: "address" };
  } catch (e) {
    console.error(`geocode error (${s.name}): ${e.message}`);
  }
  if (!geo) {
    const base = (await districtCenter(s.addr)) ?? { lat: 37.5665, lng: 126.978 };
    geo = { lat: base.lat + Math.sin(i * 2.4) * 0.0028, lng: base.lng + Math.cos(i * 2.4) * 0.0034, geoSource: "area" };
    areaFallbacks++;
  } else addressHits++;

  const kept = previousById.get(nn);
  let id;
  if (kept && !taken.has(kept.id)) { id = kept.id; reused++; }
  else {
    const branch = kr.replace(/올리브영|올리브베러/g, "").trim();
    const base = ("oy-" + (branch || "seoul").toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 48);
    id = base; let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    fresh++;
  }
  taken.add(id);

  const brand = kr.startsWith("올리브베러") ? "Olive Better" : "Olive Young";
  const branch = kr.replace(/올리브영|올리브베러/g, "").trim();
  const hours = captureHours(s.time);
  const rating = previousRatings.get(nn);
  // The finder does not mark a Global (tax-free) store, so that tag stays
  // unsourced. "late" is read off the store's own closing time.
  const late = hours && (hours.close === "24:00" || hours.close >= "22:30");

  places.push({
    id,
    name: branch ? `${brand} ${branch}` : brand,
    nameKr: kr,
    type: "olive_young",
    zone: nearestZone(geo),
    priceRange: "₩",
    ...(rating ? { rating: rating.rating, ratingCount: rating.ratingCount } : {}),
    tags: ["k-beauty"],
    ...(late ? { serviceTags: ["late"] } : {}),
    address: s.addr,
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    ...(hours ? { hours } : {}),
    geoSource: geo.geoSource,
    // PLACES publishes a district-centroid pin only when it is declared
    // provisional, because the sheet then tells the visitor the pin is
    // neighbourhood-level. Without this the store is dropped entirely, which
    // is worse: the shop exists and they cannot find it at all.
    ...(geo.geoSource === "area" ? { locationVerification: "provisional" } : {}),
    storeCode: s.code,
  });
  if (i % 25 === 0) console.log(`  ${i}/${stores.length} (reused ids ${reused}, new ${fresh}, cache ${cacheHits})…`);
}

// Same-complex stores can geocode to one building point — nudge ~25m so both
// stay tappable.
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

let englishized = 0;
for (const place of places) {
  if (!/[가-힣]/.test(place.name)) continue;
  const next = englishizeName(place.name);
  if (!next || next === place.name || /[가-힣]/.test(next)) continue;
  place.name = next;
  englishized++;
}
// The Kakao-sourced per-day hours (2026-08-23) are better than the finder's
// single capture day, so they win wherever they exist.
const hoursApplied = applyHoursOverrides(places);

const dropped = [...previousById.keys()].filter((k) => !stores.some((s) => normName(displayKr(s.name)) === k));
console.log(`\nreused ids ${reused}  new stores ${fresh}  dropped ${dropped.length}`);
console.log(`geocode: ${addressHits} address, ${areaFallbacks} district fallback, ${cacheHits} served from cache`);
console.log(`titles englishized ${englishized}  per-day hours overrides applied ${hoursApplied}`);
if (dropped.length) console.log(`dropped (absent from the official roster): ${dropped.join(", ")}`);

mkdirSync(dirname(OUT_PATH), { recursive: true });
const header = `// AUTO-GENERATED by scripts/build-oliveyoung-official.mjs — do not edit by hand.
// Source: Olive Young's own store finder, data/sources/oliveyoung-seoul-2026-09-23.json
// (${places.length} Seoul stores; ${addressHits} address-geocoded, ${areaFallbacks} district-level fallbacks,
// ${reused} ids carried over from the previous build).
//
// hours: ${hoursApplied} stores carry the per-day schedule backfilled from Kakao
// (2026-08-23). The rest carry the finder's hours for the DAY OF CAPTURE only,
// applied to every weekday — right for a store that keeps one schedule, wrong
// for one that opens later on Sunday. A per-day backfill is still owed.

import type { Place } from "../data";

export const OLIVEYOUNG_PLACES: Place[] = `;
writeFileSync(OUT_PATH, header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n");
console.log(`\nwrote ${OUT_PATH} (${places.length} stores)`);
