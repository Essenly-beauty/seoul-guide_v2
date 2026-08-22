#!/usr/bin/env node
// Real subway exit coordinates from OpenStreetMap, replacing the synthetic ring
// lib/subway.ts used to generate (owner decision 2026-08-22: get the real data
// now, swap the fiction out).
//
//   node scripts/build-station-exits.mjs
//
// OSM tags `railway=subway_entrance` nodes with `ref` = the exit number and,
// on most of them, a description naming the station ("Gangnam Station gate 10",
// "동대문역사문화공원 4번출구"). Matching therefore runs NAME-FIRST and falls back
// to proximity only where no usable description exists — pure proximity is
// unsafe at dense interchanges where two different stations sit within 400 m.
//
// Data © OpenStreetMap contributors, ODbL — same source and licence as
// lib/generated/subway-geometry.ts.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "lib", "generated", "station-exits.ts");
const STATION_DATA = join(ROOT, "lib", "subway-data.json");
const CACHE = join(ROOT, "scripts", ".station-exits-cache.json");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const BBOX = "36.9,126.35,38.05,127.65"; // greater Seoul + Incheon + Gimpo
/** A name-matched entrance may sit anywhere sane; an unnamed one must be close. */
const PROXIMITY_RADIUS_M = 400;
/** Even a name match is rejected beyond this — it means the name collided. */
const SANITY_RADIUS_M = 1200;

/** Overpass fetch. Uses curl: node's undici fails on this network (ETIMEDOUT in
    happy-eyeballs) while curl succeeds, and the geometry pipeline has the same
    mirror-retry shape. */
function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const body = execFileSync(
        "curl",
        ["-s", "--max-time", "180", "-X", "POST", url, "--data-urlencode", `data=${query}`],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      const json = JSON.parse(body);
      if (!json.elements) throw new Error("no elements in response");
      return json;
    } catch (e) {
      lastErr = e;
      console.log(`  retry ${attempt + 1} (${e.message})`);
    }
  }
  throw lastErr;
}

const metres = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1000;
};

/** "3" → 3, "3-1" → 3 (sub-exits collapse onto their parent number). */
function exitNumber(ref) {
  const m = String(ref).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Fold spelling variants so "Nat'l Univ" and "National University" agree. */
const normalizeEn = (s) =>
  s
    .toLowerCase()
    .replace(/nat['’]?l\b/g, "national")
    .replace(/\bsh/g, "s") // Shinnonhyeon ≡ Sinnonhyeon
    .replace(/univ\b\.?/g, "university")
    .replace(/[^a-z0-9]/g, "");
const normalizeKo = (s) => s.replace(/\s/g, "").replace(/역$/, "");

/** Candidate keys for one English station name. Seoul renames stations with a
    parenthetical secondary name ("Jamsil (Songpa-gu Office)", "Chongshin Univ.
    (Isu)") while OSM usually carries only one of the two parts — and numbered
    stations differ in romanization ("Euljiro 3(sam)ga" vs "Euljiro 3-ga"). So
    index the full string, the string with parentheses removed, AND the
    parenthetical content on its own. */
function englishKeys(name) {
  if (!name) return [];
  const keys = new Set();
  keys.add(normalizeEn(name));
  const withoutParens = name.replace(/\([^)]*\)/g, " ").trim();
  if (withoutParens) keys.add(normalizeEn(withoutParens));
  for (const m of name.matchAll(/\(([^)]*)\)/g)) {
    const inner = m[1].trim();
    // "(sam)"/"(il)" in "Jongno 3(sam)ga" are romanization particles, not names
    if (inner.length > 2 && !/^(il|i|sam|sa|o|yuk|chil|pal|gu)$/i.test(inner)) keys.add(normalizeEn(inner));
  }
  return [...keys].filter(Boolean);
}

/** Strip the exit phrasing off an OSM description, leaving the station name.
    "Gangnam Station gate 10" → Gangnam · "동대문역사문화공원 4번출구" → 동대문역사문화공원 */
function stationNameFrom(tags) {
  const en = tags["description:en"] ?? tags["name:en"];
  if (en) {
    const cleaned = en
      .replace(/\b(gate|exit|entrance|출구)\b.*$/i, "")
      .replace(/\bstations?\b/i, "")
      .trim()
      .replace(/[,·-]+$/, "")
      .trim();
    if (cleaned) return { keys: englishKeys(cleaned), raw: en };
  }
  const ko = tags["description:ko"] ?? tags.description ?? tags.name;
  if (ko) {
    const cleaned = ko
      .replace(/\s*\d+\s*번?\s*출입?구.*$/, "")
      .replace(/\s*\d+\s*(번)?\s*$/, "")
      .trim();
    if (cleaned) return { keys: [normalizeKo(cleaned)], raw: ko };
  }
  return null;
}

const raw = JSON.parse(readFileSync(STATION_DATA, "utf8"));
const stationSource = raw.stations ?? raw;
const stations = Array.isArray(stationSource)
  ? stationSource
  : Object.entries(stationSource).map(([id, s]) => ({ id, ...s }));
console.log(`stations: ${stations.length}`);

// name index — English and Korean both point at the station id. Ambiguous names
// (two stations sharing a normalized name) are dropped so they fall through to
// proximity rather than binding to an arbitrary winner.
const nameIndex = new Map();
const ambiguous = new Set();
const addName = (key, id) => {
  if (!key) return;
  const prev = nameIndex.get(key);
  if (prev && prev !== id) ambiguous.add(key);
  nameIndex.set(key, id);
};
for (const s of stations) {
  for (const key of englishKeys(s.name ?? "")) addName(key, s.id);
  addName(normalizeKo(s.nameKr ?? ""), s.id);
}
for (const key of ambiguous) nameIndex.delete(key);
console.log(`name index: ${nameIndex.size} unique names (${ambiguous.size} ambiguous, proximity-only)`);

let json;
if (existsSync(CACHE)) {
  console.log("using cached Overpass response (delete scripts/.station-exits-cache.json to refetch)");
  json = JSON.parse(readFileSync(CACHE, "utf8"));
} else {
  console.log("querying OSM for railway=subway_entrance…");
  json = overpass(`[out:json][timeout:150];node["railway"="subway_entrance"](${BBOX});out body;`);
  writeFileSync(CACHE, JSON.stringify(json));
}
const nodes = (json.elements ?? []).filter((e) => e.tags?.ref);
console.log(`tagged entrances: ${nodes.length}`);

const byStation = new Map();
const stats = { byName: 0, byProximity: 0, nameUnknown: 0, tooFar: 0, nameFarRejected: 0 };
const unknownNames = new Map();

for (const node of nodes) {
  const no = exitNumber(node.tags.ref);
  if (no === null) continue;
  const point = { lat: node.lat, lng: node.lon };

  // nearest station is needed either way — as the match, or as the sanity check
  let nearest = null;
  let nearestD = Infinity;
  for (const s of stations) {
    const d = metres(point, s);
    if (d < nearestD) {
      nearestD = d;
      nearest = s;
    }
  }

  const named = stationNameFrom(node.tags);
  let station = null;
  let distance = nearestD;
  let source = "proximity";

  if (named) {
    let id = null;
    for (const key of named.keys) {
      const hit = nameIndex.get(key);
      if (hit) { id = hit; break; }
    }
    if (id) {
      const s = stations.find((x) => x.id === id);
      const d = metres(point, s);
      if (d <= SANITY_RADIUS_M) {
        station = s;
        distance = d;
        source = "name";
      } else {
        // the name resolved but the node is nowhere near it — trust neither
        stats.nameFarRejected++;
        continue;
      }
    } else {
      stats.nameUnknown++;
      const key = named.keys[0] ?? named.raw;
      const list = unknownNames.get(key) ?? { raw: named.raw, count: 0 };
      list.count++;
      unknownNames.set(key, list);
    }
  }

  if (!station) {
    if (!nearest || nearestD > PROXIMITY_RADIUS_M) {
      stats.tooFar++;
      continue;
    }
    station = nearest;
    distance = nearestD;
  }

  stats[source === "name" ? "byName" : "byProximity"]++;
  if (!byStation.has(station.id)) byStation.set(station.id, new Map());
  const exits = byStation.get(station.id);
  // Duplicate ref at one station (sub-exits 3-1/3-2, or a mapping duplicate):
  // keep the one closest to the station centre — the one a visitor at the
  // platform is directed to.
  const prev = exits.get(no);
  if (!prev || distance < prev.d) exits.set(no, { no, lat: node.lat, lng: node.lon, d: distance });
}

const round = (n) => Number(n.toFixed(6));
const out = {};
for (const [id, exits] of [...byStation.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  out[id] = [...exits.values()]
    .sort((a, b) => a.no - b.no)
    .map((e) => ({ no: e.no, lat: round(e.lat), lng: round(e.lng) }));
}

const kept = Object.values(out).reduce((n, list) => n + list.length, 0);
const covered = Object.keys(out).length;
console.log(
  `\nmatched ${kept} exits across ${covered}/${stations.length} stations (${Math.round((covered / stations.length) * 100)}%)`,
);
console.log(
  `  by station name: ${stats.byName} · by proximity: ${stats.byProximity} · ` +
    `unmatched: name-not-in-dataset ${stats.nameUnknown}, too far ${stats.tooFar}, name-far ${stats.nameFarRejected}`,
);
if (unknownNames.size > 0) {
  const top = [...unknownNames.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  console.log(`  names OSM knows that our dataset doesn't (top ${top.length}):`);
  for (const u of top) console.log(`    ${u.count}× "${u.raw}"`);
}
const missing = stations.filter((s) => !out[s.id]);
if (missing.length > 0) {
  console.log(`  stations with no mapped exits (${missing.length}): ${missing.slice(0, 12).map((s) => s.id).join(", ")}${missing.length > 12 ? " …" : ""}`);
}

const header = `// GENERATED by scripts/build-station-exits.mjs — do not edit by hand.
// Real subway exit coordinates from OpenStreetMap (railway=subway_entrance,
// ref = exit number), matched to lib/subway-data.json stations by station name
// first (from the OSM description) and by proximity only as a fallback.
// Data © OpenStreetMap contributors, ODbL.
// Stations absent from this map have no exits mapped upstream — callers must
// render nothing rather than inventing a substitute.

export type GeneratedExit = { no: number; lat: number; lng: number };

export const STATION_EXITS: Record<string, GeneratedExit[]> = `;

writeFileSync(
  OUT,
  header + JSON.stringify(out, null, 2).replace(/"([a-zA-Z][a-zA-Z0-9]*)":/g, "$1:") + ";\n",
);
console.log(`wrote ${OUT}`);
