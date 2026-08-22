#!/usr/bin/env node
// Audit lib/subway-data.json station coordinates against real OpenStreetMap
// exit positions, and record the provable errors as coordinate overrides.
//
//   node scripts/audit-station-coords.mjs           # report only
//   node scripts/audit-station-coords.mjs --write   # write overrides + patch
//
// Why: KRIC's 위도/경도 column has occasional bad rows. 이촌 (Ichon) was filed
// at 37.52919/126.9679818 — 12 m from 신용산 (Sinyongsan), ~960 m from where
// its own six OSM exits are. 마곡 (Magok) was ~1 km west of its exits. Both
// are silent failures: the map draws the station on the wrong block and route
// walking distances are wrong, but nothing crashes.
//
// Evidence: OSM `railway=subway_entrance` nodes (scripts/.station-exits-cache.json,
// the same cache scripts/build-station-exits.mjs uses), bound to stations by
// the shared NAME-FIRST matcher in scripts/lib/osm-exit-match.mjs. Proximity
// matching is deliberately NOT used here — a station whose coordinate is wrong
// would attract its neighbour's entrances and confirm its own error.
//
// Output follows the scripts/lib/kr-name-overrides.json convention: the fix
// lives in a checked-in JSON file that scripts/build-subway-data.mjs re-applies
// on every rebuild, and this script also patches lib/subway-data.json in place
// so no full pipeline rerun is needed.
//
// Data © OpenStreetMap contributors, ODbL.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildNameIndex,
  exitNumber,
  metres,
  stationList,
  stationNameFrom,
} from "./lib/osm-exit-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATION_DATA = join(ROOT, "lib", "subway-data.json");
const CACHE = join(ROOT, "scripts", ".station-exits-cache.json");
const OVERRIDES_PATH = join(ROOT, "scripts", "lib", "station-coord-overrides.json");

/** Below this, the gap is platform spread / entrance geometry, not an error.
    Real Seoul stations are 200-400 m long, so a centroid can sit a couple of
    hundred metres from the recorded centre without anything being wrong. */
const CORRECTION_THRESHOLD_M = 300;
/** A name match this far out is a name collision, not a misplaced station.
    (The builder's own sanity radius is 1200 m; the audit has to look past it
    or a station that is 2 km wrong would simply vanish from the report.) */
const AUDIT_SANITY_RADIUS_M = 6000;
/** Fewer exits than this is not a centre estimate, it is a sample of one side.
    청량리 is the worked example: OSM describes only 3 of its 6 known entrances
    in English, and all 3 sit at the west end of a station complex that is
    itself ~400 m long, so their centroid is ~310 m from the recorded centre
    while the recorded centre is fine. Five-plus entrances distributed around a
    station body are needed before a centroid may overrule KRIC. */
const MIN_EXITS = 5;
/** Single-linkage radius for grouping entrances into station bodies. */
const CLUSTER_LINK_M = 300;
/** Exits scattered wider than this never produce a correction. */
const MAX_SPREAD_M = 400;

const round = (n) => Number(n.toFixed(6));

/** Single-linkage clustering of entrances. One station id in our dataset can
    cover two physically separate station bodies — 신촌 is one id carrying both
    the Line 2 station and the Gyeongui–Jungang station 700 m away, each with
    its own numbered entrances. Their combined centroid is a point in between
    that matches neither, so a multi-cluster station is reported and skipped
    rather than "corrected" onto a spot with no station on it. */
function clusters(points) {
  const groups = [];
  for (const p of points) {
    const touching = groups.filter((g) => g.some((q) => metres(p, q) <= CLUSTER_LINK_M));
    if (touching.length === 0) {
      groups.push([p]);
      continue;
    }
    const merged = [p, ...touching.flat()];
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  return groups.sort((a, b) => b.length - a.length);
}

const raw = JSON.parse(readFileSync(STATION_DATA, "utf8"));
const stations = stationList(raw);
const byId = new Map(stations.map((s) => [s.id, s]));
const { nameIndex } = buildNameIndex(stations);

if (!existsSync(CACHE)) {
  console.error(`missing ${CACHE} — run scripts/build-station-exits.mjs first`);
  process.exit(1);
}
const json = JSON.parse(readFileSync(CACHE, "utf8"));
const nodes = (json.elements ?? []).filter((e) => e.tags?.ref);

// name-matched entrances only, grouped by station
const exitsByStation = new Map();
for (const node of nodes) {
  if (exitNumber(node.tags.ref) === null) continue;
  const named = stationNameFrom(node.tags);
  if (!named) continue;
  let id = null;
  for (const key of named.keys) {
    const hit = nameIndex.get(key);
    if (hit) {
      id = hit;
      break;
    }
  }
  if (!id) continue;
  const station = byId.get(id);
  if (metres({ lat: node.lat, lng: node.lon }, station) > AUDIT_SANITY_RADIUS_M) continue;
  if (!exitsByStation.has(id)) exitsByStation.set(id, []);
  exitsByStation.get(id).push({ lat: node.lat, lng: node.lon, ref: node.tags.ref });
}

const rows = [];
for (const [id, exits] of exitsByStation) {
  const station = byId.get(id);
  const centroid = {
    lat: exits.reduce((n, e) => n + e.lat, 0) / exits.length,
    lng: exits.reduce((n, e) => n + e.lng, 0) / exits.length,
  };
  const spread = Math.max(...exits.map((e) => metres(e, centroid)));
  const groups = clusters(exits);
  rows.push({
    id,
    nameKr: station.nameKr,
    name: station.name,
    offset: metres(station, centroid),
    centroid,
    exits: exits.length,
    spread,
    bodies: groups.filter((g) => g.length >= 2).length,
  });
}
rows.sort((a, b) => b.offset - a.offset);

console.log(
  `audited ${rows.length}/${stations.length} stations against name-matched OSM exits ` +
    `(threshold ${CORRECTION_THRESHOLD_M} m, min ${MIN_EXITS} exits, max spread ${MAX_SPREAD_M} m)\n`,
);

const correct = [];
const skipped = [];
for (const r of rows) {
  if (r.offset < CORRECTION_THRESHOLD_M) continue;
  const reason =
    r.bodies > 1
      ? `${r.bodies} separate exit clusters — one id covering two station bodies`
      : r.exits < MIN_EXITS
        ? `only ${r.exits} exit(s) — a partial sample, too thin to overrule KRIC`
        : r.spread > MAX_SPREAD_M
          ? `exits spread ${Math.round(r.spread)} m — multi-platform or name collision`
          : null;
  if (reason) skipped.push({ ...r, reason });
  else correct.push(r);
}

const line = (r) =>
  `  ${r.id.padEnd(34)} ${r.nameKr.padEnd(8)} off ${String(Math.round(r.offset)).padStart(5)} m  ` +
  `${String(r.exits).padStart(2)} exits, spread ${String(Math.round(r.spread)).padStart(3)} m, ` +
  `${r.bodies} body(s)  ${round(r.centroid.lat)}, ${round(r.centroid.lng)}`;

console.log(`CORRECT (${correct.length}):`);
for (const r of correct) console.log(line(r));

console.log(`\nOVER THRESHOLD BUT LEFT ALONE (${skipped.length}):`);
for (const r of skipped) console.log(`${line(r)}\n      ↳ ${r.reason}`);

const near = rows.filter((r) => r.offset >= 150 && r.offset < CORRECTION_THRESHOLD_M);
console.log(`\nWITHIN NORMAL PLATFORM SPREAD, 150-${CORRECTION_THRESHOLD_M} m (${near.length}, not touched):`);
for (const r of near) console.log(line(r));

if (!process.argv.includes("--write")) {
  console.log("\n(report only — pass --write to record overrides)");
  process.exit(0);
}

// ── write overrides, keeping any hand-added entries that this run did not
//    re-derive (the JSON file is the source of truth, not this run's output) ──
const existing = existsSync(OVERRIDES_PATH) ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) : {};
const overrides = { ...existing };
for (const r of correct) {
  overrides[r.id] = {
    lat: round(r.centroid.lat),
    lng: round(r.centroid.lng),
    note: `OSM exit centroid (${r.exits} exits); KRIC row was ${Math.round(r.offset)} m off`,
  };
}
const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\noverrides written: ${OVERRIDES_PATH} — ${Object.keys(sorted).length} station(s)`);

// patch lib/subway-data.json in place (no pipeline rerun needed)
let patched = 0;
for (const [id, o] of Object.entries(sorted)) {
  const station = raw.stations?.[id];
  if (!station) {
    console.warn(`  ! override for unknown station "${id}" — ignored`);
    continue;
  }
  if (station.lat === o.lat && station.lng === o.lng) continue;
  station.lat = o.lat;
  station.lng = o.lng;
  patched += 1;
}
if (patched > 0) {
  writeFileSync(STATION_DATA, JSON.stringify(raw));
  console.log(`${STATION_DATA}: ${patched} coordinate(s) patched`);
}
