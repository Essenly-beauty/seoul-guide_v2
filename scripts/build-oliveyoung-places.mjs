// Build lib/generated/oliveyoung-places.ts from OpenStreetMap (Overpass API).
//
//   node scripts/build-oliveyoung-places.mjs [--refresh]
//
// Fetches every Olive Young store mapped inside Seoul and converts it to the
// app's Place shape. The raw Overpass response is cached at
// scripts/.oliveyoung-overpass.json; pass --refresh to re-query OSM.
// OSM covers ~96 of Olive Young's Seoul stores — partial but real coverage.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_PATH = join(ROOT, "scripts", ".oliveyoung-overpass.json");
const OUT_PATH = join(ROOT, "lib", "generated", "oliveyoung-places.ts");

// ── Fetch (cached) ─────────────────────────────────────────
const QUERY = `
[out:json][timeout:60];
area["name"="서울특별시"]["admin_level"="4"]->.seoul;
(
  node["shop"]["name"~"올리브영|Olive Young",i](area.seoul);
  way["shop"]["name"~"올리브영|Olive Young",i](area.seoul);
  node["brand"~"올리브영|Olive Young",i](area.seoul);
  way["brand"~"올리브영|Olive Young",i](area.seoul);
);
out center tags;
`;

async function fetchElements() {
  if (existsSync(CACHE_PATH) && !process.argv.includes("--refresh")) {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  }
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "essenly-prototype-data-import/0.1" },
    body: new URLSearchParams({ data: QUERY }),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = await res.json();
  const seen = new Set();
  const elements = data.elements.filter((e) => {
    const key = `${e.type}/${e.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  writeFileSync(CACHE_PATH, JSON.stringify(elements, null, 1));
  return elements;
}

// ── Zone assignment (same centroids as build-creatrip-places) ──
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

// Curated Olive Young samples in lib/data.ts — drop OSM twins nearby.
const CURATED = [
  { id: "oy-gangnam-town", lat: 37.5006, lng: 127.0266 },
  { id: "oy-gangnam-stn", lat: 37.4972, lng: 127.0287 },
  { id: "oy-myeongdong", lat: 37.5637, lng: 126.9847 },
  { id: "oy-hongdae", lat: 37.5563, lng: 126.9236 },
  { id: "oy-seongsu", lat: 37.5444, lng: 127.0561 },
  { id: "oy-itaewon", lat: 37.5346, lng: 126.9942 },
];

// ── Naming ─────────────────────────────────────────────────
const branchOf = (tags) => {
  // branch tag first ("구로디지털점 (Oliveyoung Guro Digital)"), else the
  // Korean name's suffix ("올리브영 명동중앙점" → "명동중앙점").
  const branch = tags.branch ?? (tags.name?.includes("올리브영") ? tags.name.replace(/올리브영/g, "").trim() : "");
  if (!branch) return { en: "", ko: "" };
  const en = (branch.match(/\(([^)]*[A-Za-z][^)]*)\)/) ?? [])[1]?.replace(/Olive\s?young/i, "").trim() ?? "";
  const ko = branch.replace(/\([^)]*\)/g, "").trim();
  return { en, ko };
};

function parseHours(oh) {
  if (!oh) return undefined;
  if (oh === "24/7") return { open: "00:00", close: "23:59" };
  const m = oh.match(/^Mo-Su (\d\d:\d\d)-(\d\d:\d\d)$/);
  return m ? { open: m[1], close: m[2] } : undefined;
}

// ── Main ───────────────────────────────────────────────────
const elements = await fetchElements();
console.log(`overpass elements: ${elements.length}`);

const stores = elements.map((e) => {
  const tags = e.tags ?? {};
  return {
    osmId: `${e.type}/${e.id}`,
    lat: e.lat ?? e.center.lat,
    lng: e.lon ?? e.center.lon,
    tags,
    richness: (tags.branch ? 2 : 0) + (tags.opening_hours ? 1 : 0) + (tags["name:en"] ? 1 : 0) + Object.keys(tags).length / 100,
  };
});

// Self-dedupe: within 60m the richer element wins (same store mapped twice).
stores.sort((a, b) => b.richness - a.richness);
const kept = [];
let selfDropped = 0, curatedDropped = 0;
for (const s of stores) {
  if (CURATED.some((c) => km(c, s) < 0.12)) { curatedDropped++; continue; }
  if (kept.some((k) => km(k, s) < 0.06)) { selfDropped++; continue; }
  kept.push(s);
}
kept.sort((a, b) => a.lat - b.lat || a.lng - b.lng); // stable output order

const taken = new Set();
const places = kept.map((s) => {
  const { en, ko } = branchOf(s.tags);
  const name = en ? `Olive Young ${en}` : ko ? `Olive Young ${ko}` : "Olive Young";
  const nameKr = ko ? `올리브영 ${ko}` : "올리브영";
  const hours = parseHours(s.tags.opening_hours);
  let base = ("oy-" + (en || ko ? (en || ko).toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "") : "osm-" + s.osmId.replace("/", "-"))).slice(0, 48);
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  const zone = nearestZone(s);
  return {
    id,
    name,
    nameKr,
    type: "olive_young",
    zone,
    priceRange: "₩",
    tags: ["k-beauty"],
    address: s.tags["addr:full"] ?? s.tags["addr:street"] ?? "Seoul",
    lat: Number(s.lat.toFixed(6)),
    lng: Number(s.lng.toFixed(6)),
    ...(hours ? { hours } : {}),
    ...(hours && hours.close >= "22:00" ? { serviceTags: ["late"] } : {}),
    geoSource: "address",
  };
});

mkdirSync(dirname(OUT_PATH), { recursive: true });
const header = `// AUTO-GENERATED by scripts/build-oliveyoung-places.mjs — do not edit by hand.
// Source: OpenStreetMap via Overpass (${places.length} Seoul stores; ${selfDropped} OSM twins + ${curatedDropped} curated twins deduped).
// © OpenStreetMap contributors, ODbL.

import type { Place } from "../data";

export const OLIVEYOUNG_PLACES: Place[] = `;
writeFileSync(OUT_PATH, header + JSON.stringify(places, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n");

console.log(`wrote ${OUT_PATH}`);
console.log(`stores: ${places.length} (dropped ${selfDropped} self-duplicates, ${curatedDropped} near curated samples)`);
const byZone = {};
for (const p of places) byZone[p.zone] = (byZone[p.zone] ?? 0) + 1;
console.log("zones:", Object.entries(byZone).sort((a, b) => b[1] - a[1]).map(([z, c]) => `${z}:${c}`).join(" "));
