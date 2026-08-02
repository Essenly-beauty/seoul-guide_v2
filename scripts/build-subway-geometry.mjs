// Build lib/generated/subway-geometry.ts — real track polylines per line from
// OpenStreetMap (Overpass), so the on-map route follows actual rails instead
// of station-to-station straight lines.
//
//   node scripts/build-subway-geometry.mjs [--refresh]
//
// One relation (a single direction) is stitched per line; lines we can't
// match keep no geometry and the runtime falls back to straight hops.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "scripts", ".subway-geometry-cache.json");
const OUT = join(ROOT, "lib", "generated", "subway-geometry.ts");

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const BBOX = "36.9,126.35,38.05,127.65"; // greater Seoul + Incheon + Gimpo

/** line id -> matcher over relation tags (name / name:ko / ref). */
const MATCHERS = {
  "1": (t) => isSeoulNumbered(t, "1"),
  "2": (t) => isSeoulNumbered(t, "2"),
  "3": (t) => isSeoulNumbered(t, "3"),
  "4": (t) => isSeoulNumbered(t, "4"),
  "5": (t) => isSeoulNumbered(t, "5"),
  "6": (t) => isSeoulNumbered(t, "6"),
  "7": (t) => isSeoulNumbered(t, "7"),
  "8": (t) => isSeoulNumbered(t, "8"),
  "9": (t) => isSeoulNumbered(t, "9"),
  suin_bundang: (t) => /수인.?분당/.test(all(t)),
  sinbundang: (t) => /신분당/.test(all(t)),
  gyeongui_jungang: (t) => /경의.?중앙/.test(all(t)),
  gyeongchun: (t) => /경춘/.test(all(t)),
  ui_sinseol: (t) => /우이신설/.test(all(t)),
  gimpo_gold: (t) => /김포.?(골드|도시철도)/.test(all(t)),
  seohae: (t) => /서해/.test(all(t)),
  sillim: (t) => /신림선/.test(all(t)),
  airport: (t) => /공항철도|A'?REX/i.test(all(t)),
  incheon1: (t) => /인천\s*(도시철도\s*)?1호선|인천교통공사.*1호선/.test(all(t)) && !/수도권/.test(all(t)),
  incheon2: (t) => /인천\s*(도시철도\s*)?2호선|인천교통공사.*2호선/.test(all(t)) && !/수도권/.test(all(t)),
};
const all = (t) => `${t.name ?? ""} ${t["name:ko"] ?? ""} ${t.ref ?? ""} ${t.line ?? ""}`;
const isSeoulNumbered = (t, n) => {
  const hay = all(t);
  // Exclude OTHER operators' numbered lines — but only when 인천 etc. names
  // the line itself, not a terminus ("소요산 → 인천" is Seoul Line 1).
  if (/인천교통공사|인천\s*(도시철도\s*)?[12]호선|김포|우이|의정부|용인|경전철/.test(hay)) return false;
  return new RegExp(`(^|[^0-9])${n}호선`).test(hay) || new RegExp(`Line ${n}(?![0-9])`).test(hay);
};

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "essenly-prototype-data-import/0.1" },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      console.log(`    retry ${attempt + 1} (${e.message})`);
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ── stitch relation member ways into one chain ─────────────
const near = (a, b) => Math.abs(a[0] - b[0]) < 0.0007 && Math.abs(a[1] - b[1]) < 0.0009; // ~80m
function stitch(ways) {
  const pool = ways.filter((w) => w.length >= 2).map((w) => [...w]);
  if (pool.length === 0) return [];
  // seed with the longest way, then greedily extend both ends
  pool.sort((a, b) => b.length - a.length);
  let chain = pool.shift();
  let grew = true;
  while (grew && pool.length > 0) {
    grew = false;
    for (let i = 0; i < pool.length; i++) {
      const w = pool[i];
      const head = chain[0], tail = chain[chain.length - 1];
      if (near(tail, w[0])) chain = chain.concat(w.slice(1));
      else if (near(tail, w[w.length - 1])) chain = chain.concat([...w].reverse().slice(1));
      else if (near(head, w[w.length - 1])) chain = w.slice(0, -1).concat(chain);
      else if (near(head, w[0])) chain = [...w].reverse().slice(0, -1).concat(chain);
      else continue;
      pool.splice(i, 1);
      grew = true;
      break;
    }
  }
  return chain;
}

// Ramer–Douglas–Peucker, epsilon in degrees (~0.00009 ≈ 10 m).
// Closed rings (Line 2) must be split first — start≈end makes the base
// chord zero-length and the whole loop collapses.
function simplify(points, epsilon = 0.00009) {
  if (points.length > 3 && near(points[0], points[points.length - 1])) {
    const mid = Math.floor(points.length / 2);
    return [
      ...simplify(points.slice(0, mid + 1), epsilon).slice(0, -1),
      ...simplify(points.slice(mid), epsilon),
    ];
  }
  if (points.length <= 2) return points;
  const dmax = { d: 0, i: 0 };
  const [sx, sy] = points[0], [ex, ey] = points[points.length - 1];
  const dx = ex - sx, dy = ey - sy;
  const norm = Math.hypot(dx, dy) || 1e-12;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = Math.abs(dy * px - dx * py + ex * sy - ey * sx) / norm;
    if (d > dmax.d) { dmax.d = d; dmax.i = i; }
  }
  if (dmax.d <= epsilon) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, dmax.i + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(dmax.i), epsilon),
  ];
}

// ── main ───────────────────────────────────────────────────
let cache = existsSync(CACHE) && !process.argv.includes("--refresh")
  ? JSON.parse(readFileSync(CACHE, "utf8"))
  : null;

if (!cache) {
  console.log("listing subway relations…");
  const list = await overpass(`[out:json][timeout:90];relation["route"="subway"](${BBOX});out tags;`);
  cache = { relations: list.elements.map((e) => ({ id: e.id, tags: e.tags ?? {} })), geoms: {} };
  writeFileSync(CACHE, JSON.stringify(cache));
}
console.log(`candidate relations: ${cache.relations.length}`);

const paths = {};
for (const [lineId, match] of Object.entries(MATCHERS)) {
  const candidates = cache.relations
    .filter((r) => match(r.tags))
    // shuttles/spurs/express variants are tiny sub-relations of the mainline
    .filter((r) => !/셔틀|지선|임시|급행|shuttle|branch/i.test(all(r.tags)));
  if (candidates.length === 0) { console.log(`  ${lineId}: no relation matched`); continue; }
  // Branch relations ("마천 → 강동") can predate the mainline — stitch every
  // candidate (capped) and keep the longest chain.
  candidates.sort((a, b) => a.id - b.id);
  let bestChain = [];
  for (const rel of candidates.slice(0, 4)) {
    if (!cache.geoms[rel.id]) {
      console.log(`  ${lineId}: fetching relation ${rel.id} (${rel.tags.name ?? rel.tags.ref ?? ""})`);
      let g;
      try {
        g = await overpass(`[out:json][timeout:120];relation(${rel.id});out geom;`);
      } catch (e) {
        console.log(`  ${lineId}: fetch failed (${e.message})`);
        continue;
      }
      const ways = [];
      for (const el of g.elements) {
        for (const m of el.members ?? []) {
          if (m.type === "way" && m.geometry && !/platform|stop/.test(m.role ?? "")) {
            ways.push(m.geometry.map((p) => [p.lat, p.lon]));
          }
        }
      }
      cache.geoms[rel.id] = ways;
      writeFileSync(CACHE, JSON.stringify(cache));
      await new Promise((r) => setTimeout(r, 1200));
    }
    const chain = stitch(cache.geoms[rel.id]);
    if (chain.length > bestChain.length) bestChain = chain;
  }
  if (bestChain.length < 2) { console.log(`  ${lineId}: stitch failed`); continue; }
  const slim = simplify(bestChain).map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
  paths[lineId] = slim;
  console.log(`  ${lineId}: best chain ${bestChain.length} pts -> ${slim.length} pts`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// AUTO-GENERATED by scripts/build-subway-geometry.mjs — do not edit by hand.
// Real track polylines per line, stitched from OSM route=subway relations
// (single direction). © OpenStreetMap contributors, ODbL.

export const LINE_PATHS: Record<string, [number, number][]> = ${JSON.stringify(paths)};
`);
console.log(`\nwrote ${OUT} (${Object.keys(paths).length}/${Object.keys(MATCHERS).length} lines)`);
