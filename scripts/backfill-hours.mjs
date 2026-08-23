#!/usr/bin/env node
// Backfill opening hours for the scraped places, which ship without any
// (0 of 556 generated rows had `hours` as of 2026-08-23 — the UI renders
// "HOURS UNKNOWN" on all of them; only the 44 curated rows in lib/data.ts
// carry hours).
//
//   KAKAO_REST_API_KEY=... node scripts/backfill-hours.mjs [options]
//
//     --dry-run          resolve + report, write nothing
//     --only=<file>      oliveyoung | creatrip | ados (repeatable)
//     --limit=N          stop after N rows per file (sampling)
//     --refresh          ignore the on-disk panel cache
//
// The REST API key is the login app's, docs/auth-setup.md §3.1.
//
// WHERE THE HOURS COME FROM — the documented Kakao Local REST API does NOT
// serve opening hours (see the field list in scripts/lib/kakao-local.mjs). It
// serves a Kakao place id, and the public place panel behind that id does. So
// this runs in two stages per row:
//
//   1. resolve a Kakao place id via Local keyword search, accuracy-first —
//      an exact normalized name match plus either proximity or a matching
//      road address. A wrong id means wrong hours, which is worse than none.
//   2. read open_hours off the place panel and keep it only when the whole
//      week is uniform (see uniformHours) — Place.hours is a single
//      { open, close } and must not misreport a day.
//
// Output: scripts/lib/hours-overrides.json, re-applied by every owning builder
// on rebuild (same contract as kr-name-overrides.json), and the generated files
// are patched here too so no pipeline rerun is needed.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readGeneratedPlaces,
  writeGeneratedPlaces,
  applyHoursOverrides,
} from "./lib/generated-places.mjs";
import { searchKeyword, placePanel, uniformHours } from "./lib/kakao-local.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_PATH = join(ROOT, "scripts", "lib", "hours-overrides.json");
const CACHE_PATH = join(ROOT, "scripts", ".kakao-hours-cache.json");

const FILES = [
  { key: "oliveyoung", path: join(ROOT, "lib", "generated", "oliveyoung-places.ts") },
  { key: "creatrip", path: join(ROOT, "lib", "generated", "creatrip-places.ts") },
  { key: "ados", path: join(ROOT, "lib", "generated", "ados-places.ts") },
];

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");
const LIMIT = Number((args.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1]) || Infinity;
const ONLY = args.filter((a) => a.startsWith("--only=")).map((a) => a.split("=")[1]);

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) {
  console.error("KAKAO_REST_API_KEY missing (Kakao Developers console — REST API 키; docs/auth-setup.md §3.1)");
  process.exit(1);
}

// ── matching ────────────────────────────────────────────────
const normName = (s) => String(s ?? "").replace(/[^가-힣a-z0-9]/gi, "").replace(/점$/, "").toLowerCase();
/** "서울 강남구 도산대로 326 대동타워 1층" → "도산대로 326" — the part Kakao's
    road_address_name also carries, so it survives building/floor suffixes. */
const roadKey = (addr) => {
  const m = String(addr ?? "").match(/([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)/);
  return m ? `${m[1]} ${m[2]}` : null;
};
const R = 6371000;
const metres = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

/**
 * Resolve the Kakao place id for one of our rows, or null.
 * Accepts only on an exact normalized-name match, corroborated by proximity
 * (≤400 m) or by an identical road address — the Olive Young rows are
 * Nominatim-geocoded so a few sit hundreds of metres off their storefront, and
 * three fall back to their 구 centroid entirely.
 */
function resolveKakaoId(place) {
  const wanted = normName(place.nameKr);
  const wantedRoad = roadKey(place.address);
  if (!wanted) return null;
  const attempts = [
    () => searchKeyword(KEY, place.nameKr, { lat: place.lat, lng: place.lng }, { radius: 800 }),
    () => searchKeyword(KEY, place.nameKr, null, { size: 15 }),
  ];
  for (const attempt of attempts) {
    let docs;
    try {
      docs = attempt();
    } catch (e) {
      console.error(`  ! ${place.id}: ${e.message}`);
      continue;
    }
    for (const d of docs) {
      if (normName(d.place_name) !== wanted) continue;
      const dist = d.distance
        ? Number(d.distance)
        : metres(place, { lat: Number(d.y), lng: Number(d.x) });
      const roadOk = wantedRoad != null && roadKey(d.road_address_name) === wantedRoad;
      if (dist <= 400 || roadOk) {
        return { id: d.id, name: d.place_name, dist: Math.round(dist), roadOk };
      }
    }
  }
  return null;
}

// ── run ─────────────────────────────────────────────────────
const cache = !REFRESH && existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const overrides = existsSync(OVERRIDES_PATH) ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) : {};
const skips = [];
const stats = { scanned: 0, alreadyHad: 0, noKakaoId: 0, noPanel: 0, notUniform: 0, filled: 0 };

for (const file of FILES) {
  if (ONLY.length > 0 && !ONLY.includes(file.key)) continue;
  const { places } = readGeneratedPlaces(file.path);
  console.log(`\n${file.key}: ${places.length} rows`);
  let n = 0;
  for (const p of places) {
    if (p.hours) {
      stats.alreadyHad += 1;
      continue;
    }
    if (n >= LIMIT) break;
    n += 1;
    stats.scanned += 1;

    // A cached MISS is only valid for the name it was searched with: the
    // Korean-name backfill renames rows, and a row that was unsearchable as
    // "Nanalog Seongsu Branch" resolves fine as "나나로그 성수점". Cached hits
    // are kept as-is — re-fetching a resolved panel buys nothing.
    let entry = cache[p.id];
    if (entry && !entry.kakaoId && entry.forName !== p.nameKr) entry = null;
    if (!entry) {
      const hit = resolveKakaoId(p);
      if (!hit) {
        entry = { kakaoId: null, forName: p.nameKr };
      } else {
        const panel = placePanel(hit.id);
        entry = {
          kakaoId: hit.id,
          kakaoName: hit.name,
          dist: hit.dist,
          roadOk: hit.roadOk,
          forName: p.nameKr,
          openHours: panel?.open_hours ? { open_hours: panel.open_hours } : null,
        };
      }
      cache[p.id] = entry;
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1)); // incremental — restarts resume
    }

    if (!entry.kakaoId) {
      stats.noKakaoId += 1;
      skips.push({ id: p.id, why: "no confident Kakao place id" });
      continue;
    }
    if (!entry.openHours) {
      stats.noPanel += 1;
      skips.push({ id: p.id, why: "Kakao panel carries no open_hours" });
      continue;
    }
    const got = uniformHours(entry.openHours);
    if (got.skip) {
      stats.notUniform += 1;
      skips.push({ id: p.id, why: got.skip });
      continue;
    }
    overrides[p.id] = {
      open: got.hours.open,
      close: got.hours.close,
      kakaoPlaceId: entry.kakaoId,
      kakaoName: entry.kakaoName,
      openDays: got.openDays,
    };
    stats.filled += 1;
    console.log(`  ✓ ${p.id} → ${got.hours.open}–${got.hours.close} (${entry.kakaoName}, ${entry.dist}m, ${got.openDays}d)`);
  }
}

// One Kakao place cannot be two of our places, so when several rows resolve to
// the same place id at most one of them is right and the others are wearing a
// neighbour's hours. (All three "JUNO HAIR | Myeongdong …" rows resolved to
// 준오헤어 명동4호점.) Drop every claimant rather than guess which is genuine —
// the same rule scripts/backfill-kr-names-2.mjs applies to contested names.
const byKakaoId = new Map();
for (const [id, fix] of Object.entries(overrides)) {
  byKakaoId.set(fix.kakaoPlaceId, [...(byKakaoId.get(fix.kakaoPlaceId) ?? []), id]);
}
let withdrawn = 0;
for (const [kakaoId, ids] of byKakaoId) {
  if (ids.length < 2) continue;
  const name = overrides[ids[0]].kakaoName;
  for (const id of ids) delete overrides[id];
  withdrawn += ids.length;
  skips.push(...ids.map((id) => ({ id, why: `contested Kakao place ${kakaoId}` })));
  console.log(`  ✗ withdrew "${name}" hours from ${ids.length} places: ${ids.join(", ")}`);
}
console.log(
  `\nscanned ${stats.scanned} rows without hours — filled ${stats.filled}` +
    (withdrawn > 0 ? `, withdrew ${withdrawn} contested` : "") +
    "; " +
    `skipped: no-id ${stats.noKakaoId}, no-open_hours ${stats.noPanel}, non-uniform week ${stats.notUniform}`,
);
const byReason = {};
for (const s of skips) {
  const k = s.why.split(":")[0];
  byReason[k] = (byReason[k] ?? 0) + 1;
}
console.log("skip reasons:", Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));

if (DRY) {
  console.log("\n--dry-run: nothing written");
  process.exit(0);
}

const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nwrote ${OVERRIDES_PATH} — ${Object.keys(sorted).length} places`);

for (const file of FILES) {
  const { header, places } = readGeneratedPlaces(file.path);
  // Strip first, then re-apply: a withdrawn override has to leave the file,
  // and rebuilding from the override set is exactly what a pipeline rerun
  // produces, so the two can't drift.
  const stripped = places.map(({ hours, ...rest }) => rest);
  const applied = applyHoursOverrides(stripped, sorted);
  writeGeneratedPlaces(file.path, header, stripped);
  console.log(`${file.path}: ${applied} hours applied`);
}
