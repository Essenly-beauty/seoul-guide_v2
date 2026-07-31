// Build lib/generated/ados-places.ts from the two "a drop of seoul" CSVs
// (Seoul attractions + observation towers & traditional markets).
//
//   node scripts/build-ados-places.mjs [attractions.csv] [towers_markets.csv]
//
// Same machinery as build-creatrip-places.mjs: Nominatim geocoding with an
// on-disk cache (scripts/.ados-geocode-cache.json), zone by nearest centroid.
// Extras here: landmark rows can geocode by NAME when the address is vague
// ("종로구 일대"), and rows duplicating curated places in lib/data.ts or the
// sibling CSV are dropped (report printed at the end).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const F_ATTRACTIONS = process.argv[2] ?? join(process.env.HOME, "Downloads", "a_drop_of_seoul_places.csv");
const F_TOWERS_MARKETS = process.argv[3] ?? join(process.env.HOME, "Downloads", "a_drop_of_seoul_places_전망대타워_시장.csv");
const CACHE_PATH = join(ROOT, "scripts", ".ados-geocode-cache.json");
const OUT_PATH = join(ROOT, "lib", "generated", "ados-places.ts");

// ── CSV (same dialect as build-creatrip-places) ────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  const header = rows.shift().map((h) => h.replace(/^﻿/, "").trim());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ── Normalize both files into one row shape ────────────────
const num = (s) => {
  const v = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(v) && String(s).trim() !== "" && String(s).trim() !== "-" ? v : undefined;
};

const CATEGORY_MAP = [
  { re: /시장/, type: "mall", tags: ["market", "traditional"] },
  { re: /쇼핑몰/, type: "mall", tags: ["shopping"] },
  { re: /전망대|타워/, type: "etc", tags: ["tower", "view"] },
  { re: /박물관/, type: "etc", tags: ["museum"] },
  { re: /역사|건축물/, type: "etc", tags: ["history", "landmark"] },
  { re: /아트|극장/, type: "etc", tags: ["art & theater"] },
  { re: /테마파크/, type: "etc", tags: ["theme park"] },
  { re: /공원|물길|산책로/, type: "etc", tags: ["park", "walk"] },
  { re: /랜드마크|인근지역|즐길거리/, type: "etc", tags: ["landmark"] },
];
function classify(cat) {
  for (const m of CATEGORY_MAP) if (m.re.test(cat)) return m;
  return { type: "etc", tags: ["landmark"] };
}

function unify() {
  const rows = [];
  for (const r of parseCsv(readFileSync(F_ATTRACTIONS, "utf8"))) {
    rows.push({
      source: "attractions",
      nameEn: r["Name(EN)"], nameKo: r["명칭(국문)"], category: r["카테고리(국문)"],
      address: r["주소"], rating: num(r["평점"]), reviews: num(r["리뷰수"]),
      station: r["인근역/지역"], aboutKr: r["설명(국문)"], about: r["Description(EN)"],
    });
  }
  for (const r of parseCsv(readFileSync(F_TOWERS_MARKETS, "utf8"))) {
    rows.push({
      source: "towers_markets",
      nameEn: r["영문명"], nameKo: r["국문명"], category: r["카테고리"],
      address: r["주소"], rating: num(r["평점"]), reviews: num(r["리뷰수"]),
      station: "", aboutKr: r["About"], about: "", district: r["지역"],
    });
  }
  return rows;
}

// ── Dedupe key + curated places parsed from lib/data.ts ────
const normName = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
function curatedPlaces() {
  const src = readFileSync(join(ROOT, "lib", "data.ts"), "utf8");
  const body = src.slice(src.indexOf("PLACES: Place[] = ["));
  const out = [];
  for (const line of body.split("\n")) {
    const m = line.match(/id: "([^"]+)", name: "([^"]+)", nameKr: "([^"]+)", type: "([^"]+)".*?lat: ([\d.]+), lng: ([\d.]+)/);
    if (m) out.push({ id: m[1], name: m[2], nameKr: m[3], type: m[4], lat: Number(m[5]), lng: Number(m[6]) });
    if (line.includes("...CREATRIP_PLACES")) break; // curated entries only
  }
  return out;
}

// ── Geocoding (shared pattern; landmark rows also try their name) ──
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

function queryVariants(row) {
  const base = row.address.replace(/\s+/g, " ").trim();
  // "정보 부족" / "주소 미기재…" placeholder addresses are queries wasted on Nominatim.
  const usable = /정보 부족|주소 미기재/.test(base) ? "" : base;
  const noParen = usable.replace(/\([^)]*\)/g, "").trim();
  const noFloor = noParen.replace(/\s+(B?\d+F|\d+층|지하\s*\d*층?|\d+호)\b.*$/iu, "").trim();
  const spaced = noFloor
    .replace(/([가-힣]+로)\s+(\d+번?길)/g, "$1$2")
    .replace(/(번?길)(\d)/g, "$1 $2");
  const houseOnly = (spaced.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?:\s|$)/) ?? [])[1];
  // Landmarks/markets resolve well by bare name ("방학동 도깨비시장") — comma-
  // suffixed forms ("…, 서울") rank worse in Nominatim, so try bare first.
  const koName = row.nameKo.replace(/\([^)]*\)/g, "").trim();
  const byName = [koName, koName.replace(/\s+/g, ""), `${koName}, 서울`, `${row.nameEn}, Seoul`];
  return [...new Set([spaced, houseOnly, noFloor, ...byName].filter((v) => v && v.length > 3))];
}

async function geocode(row) {
  const key = `${row.address}|${row.nameKo}`;
  if (key in cache) return cache[key];
  let hit = null;
  for (const variant of queryVariants(row)) {
    hit = await nominatim(variant);
    if (hit) { hit = { ...hit, variant }; break; }
  }
  cache[key] = hit;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
  return hit;
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

const SEOUL_BOUNDS = { latMin: 37.42, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 };
const inSeoul = (p) => p.lat >= SEOUL_BOUNDS.latMin && p.lat <= SEOUL_BOUNDS.latMax && p.lng >= SEOUL_BOUNDS.lngMin && p.lng <= SEOUL_BOUNDS.lngMax;

// ── Main ───────────────────────────────────────────────────
const all = unify();
console.log(`rows: ${all.length} (attractions ${all.filter((r) => r.source === "attractions").length}, towers/markets ${all.filter((r) => r.source === "towers_markets").length})`);

// Cross-file dedupe: attractions file wins (it carries English descriptions).
const seenNames = new Set();
const rows = [];
const dropReport = [];
for (const r of [...all.filter((x) => x.source === "attractions"), ...all.filter((x) => x.source === "towers_markets")]) {
  const keys = [normName(r.nameEn), normName(r.nameKo)].filter(Boolean);
  if (keys.some((k) => seenNames.has(k))) { dropReport.push(`${r.nameEn} — duplicate of sibling CSV row`); continue; }
  keys.forEach((k) => seenNames.add(k));
  rows.push(r);
}

// Curated dedupe pass 1: by name.
const curated = curatedPlaces();
const curatedNames = new Set(curated.flatMap((c) => [normName(c.name), normName(c.nameKr)]));
const kept = rows.filter((r) => {
  const clash = [normName(r.nameEn), normName(r.nameKo)].some((k) => k && curatedNames.has(k));
  if (clash) dropReport.push(`${r.nameEn} — already curated in lib/data.ts`);
  return !clash;
});

// Geocode.
const located = [];
let done = 0, misses = 0;
for (const row of kept) {
  done++;
  let coord = null;
  try {
    const hit = await geocode(row);
    if (hit && inSeoul(hit)) coord = { lat: hit.lat, lng: hit.lng };
  } catch (e) {
    console.error(`geocode error (${row.nameEn}): ${e.message}`);
  }
  if (!coord) misses++;
  located.push({ row, coord });
  if (done % 20 === 0) console.log(`geocoded ${done}/${kept.length}…`);
}

// District centroids for miss fallback — a market with no usable address still
// names its 구 (in the 지역 column or inside the address text).
const districtCache = {};
async function districtCenter(row) {
  const gu = (row.address.match(/([가-힣]{1,6}구)(?=\s|$|\()/) ?? row.district?.match(/([가-힣]{1,6}구)/) ?? [])[1]
    ?? (row.district && row.district !== "-" ? `${row.district.replace(/구$/, "")}구` : null);
  if (!gu) return null;
  if (!(gu in districtCache)) districtCache[gu] = await nominatim(`서울특별시 ${gu}`);
  return districtCache[gu];
}

// Curated dedupe pass 2 + self dedupe: same type within 80m is the same POI.
// Address-accurate rows go first, and only they can block a newcomer — a
// district-centroid fallback pin landing near a real POI is coincidence,
// not a duplicate.
located.sort((a, b) => Number(Boolean(b.coord)) - Number(Boolean(a.coord)));
const taken = new Set();
const places = [];
for (const [i, { row, coord }] of located.entries()) {
  const { type, tags } = classify(row.category);
  let geo;
  if (coord) geo = { ...coord, geoSource: "address" };
  else {
    const base = (await districtCenter(row)) ?? { lat: 37.5665, lng: 126.978 };
    geo = { // deterministic ~±300m scatter inside the district so misses stay apart
      lat: base.lat + Math.sin(i * 2.4) * 0.0028,
      lng: base.lng + Math.cos(i * 2.4) * 0.0034,
      geoSource: "area",
    };
  }
  const curatedTwin = coord && curated.find((c) => c.type === type && km(c, coord) < 0.08);
  if (curatedTwin) { dropReport.push(`${row.nameEn} — within 80m of curated ${curatedTwin.id}`); continue; }
  const selfTwin = coord && places.find((p) => p.geoSource === "address" && p.type === type && km(p, coord) < 0.06);
  if (selfTwin) { dropReport.push(`${row.nameEn} — within 60m of ${selfTwin.id}`); continue; }

  let base = ("ados-" + row.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")).slice(0, 48).replace(/-+$/g, "");
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);

  places.push({
    id,
    name: row.nameEn,
    nameKr: row.nameKo,
    type,
    zone: nearestZone(geo),
    priceRange: "₩",
    ...(row.rating !== undefined ? { rating: row.rating } : {}),
    ...(row.reviews !== undefined ? { ratingCount: row.reviews } : {}),
    tags,
    ...(row.station ? { nearestStation: row.station.replace(/역$/, "") } : {}),
    address: row.address,
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    ...(row.about ? { about: row.about } : {}),
    ...(row.aboutKr ? { aboutKr: row.aboutKr } : {}),
    geoSource: geo.geoSource,
  });
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
const header = `// AUTO-GENERATED by scripts/build-ados-places.mjs — do not edit by hand.
// Source: a_drop_of_seoul_places*.csv (${places.length} places; ${misses} geocode misses pinned at city core as "area").

import type { Place } from "../data";

export const ADOS_PLACES: Place[] = `;
writeFileSync(OUT_PATH, header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n");

console.log(`\nwrote ${OUT_PATH}`);
console.log(`places: ${places.length}, geocode misses: ${misses}, dropped: ${dropReport.length}`);
for (const d of dropReport) console.log(`  dropped: ${d}`);
const byType = {};
for (const p of places) byType[p.type] = (byType[p.type] ?? 0) + 1;
console.log("types:", JSON.stringify(byType));
