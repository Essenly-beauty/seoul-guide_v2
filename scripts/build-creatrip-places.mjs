// Build lib/generated/creatrip-places.ts from the Creatrip hair-salon CSV.
//
//   node scripts/build-creatrip-places.mjs [path/to/creatrip_hair_salons_v3.csv]
//
// Geocodes Korean street addresses via Nominatim (1 req/s policy) with an
// on-disk cache (scripts/.creatrip-geocode-cache.json) so re-runs are free.
// Rows whose address can't be resolved fall back to their neighborhood's
// centroid (computed from resolved rows) and are marked geoSource: "area".

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = process.argv[2] ?? join(process.env.HOME, "Downloads", "creatrip_hair_salons_v3.csv");
const CACHE_PATH = join(ROOT, "scripts", ".creatrip-geocode-cache.json");
const OUT_PATH = join(ROOT, "lib", "generated", "creatrip-places.ts");

// ── CSV ─────────────────────────────────────────────────────
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
  const header = rows.shift().map((h) => h.replace(/^﻿/, ""));
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// ── Address normalization ──────────────────────────────────
// Creatrip addresses carry floor/suite suffixes ("2F", "B1F 104호") and
// occasional spacing quirks ("선릉로 162길39" → official "선릉로162길 39")
// that Nominatim can't match. Try progressively normalized variants.
function addressVariants(raw) {
  const base = raw.replace(/\s+/g, " ").trim();
  const noFloor = base.replace(/\s+(B?\d+F|\d+층|지하\s*\d*층?|\d+호)\b.*$/iu, "").trim();
  const spaced = noFloor
    .replace(/([가-힣]+로)\s+(\d+번?길)/g, "$1$2")   // "서전로 46번길" → "서전로46번길"
    .replace(/(번?길)(\d)/g, "$1 $2");               // "길39" → "길 39"
  const houseOnly = (spaced.match(/^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?:\s|$)/) ?? [])[1];
  return [...new Set([spaced, houseOnly, noFloor, base].filter(Boolean))];
}

// ── Geocoding (Nominatim, cached, 1 req/s) ─────────────────
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

async function nominatim(query) {
  const wait = lastRequestAt + 1150 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": "essenly-prototype-data-import/0.1" } });
  if (!res.ok) throw new Error(`nominatim ${res.status} for ${query}`);
  const data = await res.json();
  return data[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

async function geocode(address) {
  if (address in cache) return cache[address];
  let hit = null;
  for (const variant of addressVariants(address)) {
    hit = await nominatim(variant);
    if (hit) { hit = { ...hit, variant }; break; }
  }
  cache[address] = hit;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1)); // incremental — restarts resume
  return hit;
}

// City-level sanity bounds: a "hit" in the wrong metro is worse than a miss.
const CITY_BOUNDS = {
  Seoul: { latMin: 37.42, latMax: 37.72, lngMin: 126.75, lngMax: 127.2 },
  Busan: { latMin: 35.0, latMax: 35.4, lngMin: 128.85, lngMax: 129.35 },
  Seongnam: { latMin: 37.3, latMax: 37.5, lngMin: 127.05, lngMax: 127.2 },
  Suwon: { latMin: 37.2, latMax: 37.35, lngMin: 126.9, lngMax: 127.1 },
};
const inBounds = (city, p) => {
  const b = CITY_BOUNDS[city];
  return !b || (p.lat >= b.latMin && p.lat <= b.latMax && p.lng >= b.lngMin && p.lng <= b.lngMax);
};
const CITY_CENTER = {
  Seoul: { lat: 37.5665, lng: 126.978 },
  Busan: { lat: 35.1796, lng: 129.0756 },
  Seongnam: { lat: 37.4449, lng: 127.1389 },
  Suwon: { lat: 37.2636, lng: 127.0286 },
};

// ── Zone taxonomy mapping ──────────────────────────────────
const NEIGHBORHOOD_ZONE = {
  Gangnam: "gangnam_station", "Gangnam / Apgujeong": "apgujeong", Seocho: "gangnam_station",
  Apgujeong: "apgujeong", Cheongdam: "cheongdam", Sinsa: "sinsa", Samseongdong: "samsung",
  Hongdae: "hongdae", Hapjeong: "hongdae", Sangsu: "hongdae", Yeonnamdong: "hongdae",
  Mapo: "hongdae", Gongdeok: "hongdae", Sinchon: "hongdae", Edae: "hongdae",
  Myeongdong: "myeongdong", Junggu: "myeongdong", "Seoul Station": "myeongdong",
  Jongro: "jongno", Gyeongbokgung: "jongno",
  Itaewon: "itaewon", Yongsan: "itaewon",
  Seongsudong: "seongsu", Seongdong: "seongsu", Wangsipli: "seongsu",
  "Konkuk Univ.": "seongsu", Gwangjin: "seongsu",
  Jamsil: "jamsil", Songpa: "jamsil", Gangdong: "jamsil",
  Yeouido: "yeongdeungpo", Yeongdeungpo: "yeongdeungpo",
  Gangbuk: "seoul_etc", Seongbuk: "seoul_etc", "Sungshin Women's Univ.": "seoul_etc",
  "Kyunghee Univ": "seoul_etc", Jungnang: "seoul_etc", Eunpyeong: "seoul_etc",
};
// Busan neighborhoods (Dongnae/Haeundae/Junggu/Seomyeon/Suyeong) all → busan.
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
function assignZone(row, coord) {
  if (row.city === "Busan") return "busan";
  if (row.city === "Seongnam" || row.city === "Suwon") return "gyeonggi";
  const mapped = NEIGHBORHOOD_ZONE[row.neighborhood];
  if (mapped) return mapped;
  if (coord) { // no neighborhood — nearest zone centroid within 4km, else the catch-all
    let best = null, bestKm = Infinity;
    for (const [zone, c] of Object.entries(ZONE_CENTROIDS)) {
      const d = km(coord, c);
      if (d < bestKm) { best = zone; bestKm = d; }
    }
    if (bestKm <= 4) return best;
  }
  return "seoul_etc";
}

// ── Field mapping ──────────────────────────────────────────
const cleanName = (raw) =>
  raw
    .replace(/^\[[^\]]*\]\s*/u, "") // "[Opening Event🎉] " prefixes
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
const koreanRun = (s) => (s.match(/[가-힣][가-힣\s·&]*[가-힣]/u) ?? [null])[0];

function slugify(name, taken) {
  let base = "ct-" + name.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  let slug = base, n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  taken.add(slug);
  return slug;
}

function serviceTagsFor(type, categories) {
  const tags = new Set();
  if (type === "head_spa") tags.add("scalp");
  else {
    if (/Color & Perm/i.test(categories)) { tags.add("color"); tags.add("perm"); }
    if (/Head Spa & Treatment/i.test(categories)) tags.add("treatment");
    if (/Hair & Makeup|Beauty Makeup/i.test(categories)) tags.add("cut");
  }
  return [...tags];
}

function freeTags(row) {
  const tags = [];
  if (/Men's Hair Salon/i.test(row.service_categories)) tags.push("men's hair");
  if (/Beauty Makeup|Hair & Makeup/i.test(row.service_categories)) tags.push("makeup");
  if (/Head Spa/i.test(row.service_categories)) tags.push("head spa");
  if (row.foreigner_friendly === "Y") tags.push("foreigner-friendly");
  if (tags.length === 0) tags.push("k-hair");
  return tags.slice(0, 3);
}

const priceRangeOf = (usd) => (usd <= 35 ? "₩" : usd <= 90 ? "₩₩" : "₩₩₩");

// ── Main ───────────────────────────────────────────────────
const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
console.log(`CSV rows: ${rows.length}`);

const skipped = [];
const resolved = []; // { row, coord|null }
let done = 0;
for (const row of rows) {
  done++;
  if (!row.address) { skipped.push({ name: row.name, reason: "no address" }); continue; }
  let coord = null;
  try {
    const hit = await geocode(row.address);
    if (hit && inBounds(row.city, hit)) coord = { lat: hit.lat, lng: hit.lng, geoSource: "address" };
  } catch (e) {
    console.error(`geocode error (${row.name}): ${e.message}`);
  }
  resolved.push({ row, coord });
  if (done % 20 === 0) console.log(`geocoded ${done}/${rows.length}…`);
}

// Neighborhood centroids from resolved rows → fallback for misses.
const hoodHits = new Map();
for (const { row, coord } of resolved) {
  if (!coord) continue;
  const key = `${row.city}|${row.neighborhood}`;
  (hoodHits.get(key) ?? hoodHits.set(key, []).get(key)).push(coord);
}
const centroidOf = (pts) => ({
  lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
  lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
});

let addressHits = 0, areaFallbacks = 0;
const taken = new Set();
const places = [];
for (const [i, { row, coord }] of resolved.entries()) {
  let geo = coord;
  if (geo) addressHits++;
  else {
    const hood = hoodHits.get(`${row.city}|${row.neighborhood}`);
    const zone = assignZone(row, null);
    const base = (hood && hood.length >= 2 && centroidOf(hood)) || ZONE_CENTROIDS[zone] || CITY_CENTER[row.city] || CITY_CENTER.Seoul;
    // deterministic ~±150m scatter so stacked fallbacks don't render as one pin
    geo = {
      lat: base.lat + Math.sin(i * 2.4) * 0.0013,
      lng: base.lng + Math.cos(i * 2.4) * 0.0016,
      geoSource: "area",
    };
    areaFallbacks++;
  }
  const name = cleanName(row.name);
  const type = row.service_categories.startsWith("Head Spa") ? "head_spa" : "hair_salon";
  const rating = row.rating ? Number(row.rating) : undefined;
  const usd = Number(row.price_from_usd);
  places.push({
    id: slugify(name, taken),
    name,
    // Korean names backfilled from Kakao Local live in the overrides file
    // (scripts/backfill-kr-names.mjs) — applied below after ids are final
    nameKr: koreanRun(name) ?? name,
    type,
    zone: assignZone(row, geo),
    priceRange: priceRangeOf(usd),
    ...(rating ? { rating } : {}),
    ...(row.review_count ? { ratingCount: Number(row.review_count) } : {}),
    tags: freeTags(row),
    address: row.address,
    lat: Number(geo.lat.toFixed(6)),
    lng: Number(geo.lng.toFixed(6)),
    ...(row.english_service_mentioned === "Y" ? { englishOk: true } : {}),
    serviceTags: serviceTagsFor(type, row.service_categories),
    priceFromUsd: usd,
    url: row.url,
    geoSource: geo.geoSource,
  });
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
const header = `// AUTO-GENERATED by scripts/build-creatrip-places.mjs — do not edit by hand.
// Source: creatrip_hair_salons_v3.csv (${places.length} places; ${addressHits} address-geocoded, ${areaFallbacks} area-level fallbacks).

import type { Place } from "../data";

export const CREATRIP_PLACES: Place[] = `;
// rebuilds must not lose the Kakao-sourced Korean names (2026-08-16)
const OVERRIDES_PATH = new URL("./lib/kr-name-overrides.json", import.meta.url);
if (existsSync(OVERRIDES_PATH)) {
  const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
  let applied = 0;
  for (const p of places) {
    if (overrides[p.id]) {
      p.nameKr = overrides[p.id];
      applied++;
    }
  }
  console.log(`kr-name overrides applied: ${applied}`);
}

writeFileSync(OUT_PATH, header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n");

console.log(`\nwrote ${OUT_PATH}`);
console.log(`address hits: ${addressHits}/${places.length}, area fallbacks: ${areaFallbacks}, skipped: ${skipped.length}`);
for (const s of skipped) console.log(`  skipped: ${s.name} (${s.reason})`);
const areaRows = places.filter((p) => p.geoSource === "area");
if (areaRows.length) console.log(`\narea-level (approximate) pins:\n` + areaRows.map((p) => `  ${p.name}`).join("\n"));
