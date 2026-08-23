#!/usr/bin/env node
// Second pass over the places whose `nameKr` is still the English name.
//
//   KAKAO_REST_API_KEY=... node scripts/backfill-kr-names-2.mjs [--dry-run] [--refresh]
//
// scripts/backfill-kr-names.mjs matched 68 rows on distance + Kakao category
// alone (≤100 m with an agreeing category, or ≤30 m regardless) and left 137.
// Simply widening that radius is not safe: at 150 m in Gangnam there are a
// dozen salons, and attaching the neighbour's name to a place puts a wrong
// Korean name in front of a taxi driver — worse than the English one it
// replaces. So this pass widens the radius to 150 m and pays for it with an
// independent second signal: romanized name similarity
// (scripts/lib/hangul-romanize.mjs), calibrated on the 68 pairs the first pass
// already proved correct.
//
// It also searches differently. The first pass only queried Kakao with our
// English name, which fails whenever Kakao indexes the shop in Korean only.
// This one additionally sweeps the neighbourhood by category keyword ("미용실",
// "헤어", …) to get the full local candidate pool, then picks by name.
//
// Nothing is applied on a hunch. Every row lands in one of three buckets and
// the whole thing is written out as a reviewable report:
//
//   applied  — a clear single winner with real name evidence
//   review   — a plausible candidate that is not unambiguous; NOT applied
//   none     — nothing credible within 150 m
//
// Applied rows are merged into scripts/lib/kr-name-overrides.json (which
// scripts/build-creatrip-places.mjs re-applies on every rebuild) and patched
// into lib/generated/*.ts. The report goes to scripts/kr-name-pass2-report.md.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readGeneratedPlaces, writeGeneratedPlaces } from "./lib/generated-places.mjs";
import { searchKeyword } from "./lib/kakao-local.mjs";
import { nameEvidence, nameKey, stripBranch } from "./lib/hangul-romanize.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OVERRIDES_PATH = join(ROOT, "scripts", "lib", "kr-name-overrides.json");
const CACHE_PATH = join(ROOT, "scripts", ".kr-name-pass2-cache.json");
const DECISIONS_PATH = join(ROOT, "scripts", ".kr-name-pass2-decisions.json");
const REPORT_PATH = join(ROOT, "scripts", "kr-name-pass2-report.md");
const FILES = [
  join(ROOT, "lib", "generated", "creatrip-places.ts"),
  join(ROOT, "lib", "generated", "ados-places.ts"),
];

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");

const KEY = process.env.KAKAO_REST_API_KEY;
if (!KEY) {
  console.error("KAKAO_REST_API_KEY missing (docs/auth-setup.md §3.1)");
  process.exit(1);
}

// ── thresholds ──────────────────────────────────────────────
// Calibrated against the 68 first-pass matches (all independently corroborated
// by ≤100 m + category): at 0.55 the score keeps 78% of them, at 0.35 it keeps
// 88%. 0.55 is therefore the auto-apply bar and 0.35 the review floor.
const AUTO_SIMILARITY = 0.55;
const REVIEW_SIMILARITY = 0.35;
const MAX_DISTANCE_M = 150;
/** A winner must beat the runner-up by this much, or it isn't unambiguous. */
const MARGIN = 0.12;
/** Name evidence this strong stands on its own without category agreement. */
const STRONG_SIMILARITY = 0.8;
/** …and a ratio is not enough on its own: two five-letter keys sharing two
    accidental bigrams score 0.57. Demand real overlap as well. */
const MIN_SHARED_BIGRAMS = 3;
/** The first pass's own rule — a candidate practically on top of us is the
    same storefront — which it could only apply to the handful of places Kakao
    returned for an English query. The category sweep finally surfaces the
    Korean-only shops it never saw, so the rule gets to run on them too, but
    only where nothing else is nearby enough to be confused with it. */
const SAME_STOREFRONT_M = 20;
const STOREFRONT_ISOLATION_M = 60;

/** Kakao category_name keywords corroborating each of our place types —
    same table as the first pass. */
const CATEGORY_HINTS = {
  hair_salon: ["미용실", "헤어", "미용"],
  head_spa: ["두피", "헤어", "미용", "스파", "테라피"],
  skin_clinic: ["피부과", "피부", "에스테틱", "클리닉", "의원"],
  nail_lash: ["네일", "속눈썹", "왁싱", "뷰티"],
  personal_color: ["퍼스널컬러", "이미지컨설팅", "화장품", "뷰티"],
  makeup: ["메이크업", "뷰티", "화장"],
  olive_young: ["올리브영"],
  mall: ["쇼핑", "백화점", "몰"],
  etc: [],
};
/** Category keywords to sweep the neighbourhood with, per place type. */
const SWEEP_QUERIES = {
  hair_salon: ["미용실", "헤어"],
  head_spa: ["두피관리", "헤드스파"],
  skin_clinic: ["피부과", "피부관리"],
  nail_lash: ["네일샵", "속눈썹"],
  personal_color: ["퍼스널컬러"],
  makeup: ["메이크업"],
};

const hasHangul = (s) => /[가-힣]/.test(s);
const categoryOk = (doc, type) => {
  const hints = CATEGORY_HINTS[type] ?? [];
  return hints.length === 0 || hints.some((h) => (doc.category_name ?? "").includes(h));
};

// ── candidate gathering ─────────────────────────────────────
const cache = !REFRESH && existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};

function candidatesFor(place) {
  if (cache[place.id]) return cache[place.id];
  const base = place.name.split("|")[0].trim();
  const queries = [
    base,
    base.split(/\s+/).slice(0, 3).join(" "),
    ...(SWEEP_QUERIES[place.type] ?? []),
  ];
  const seen = new Map();
  for (const q of [...new Set(queries)].filter(Boolean)) {
    let docs = [];
    try {
      docs = searchKeyword(KEY, q, { lat: place.lat, lng: place.lng }, { radius: MAX_DISTANCE_M, size: 15 });
    } catch (e) {
      console.error(`  ! ${place.id} "${q}": ${e.message}`);
    }
    for (const d of docs) {
      if (!seen.has(d.id)) {
        seen.set(d.id, {
          id: d.id,
          place_name: d.place_name,
          category_name: d.category_name,
          distance: Number(d.distance),
        });
      }
    }
  }
  const list = [...seen.values()];
  cache[place.id] = list;
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1)); // incremental — restarts resume
  return list;
}

/** Score and rank the local candidate pool for one place. */
function rank(place, docs) {
  const base = place.name.split("|")[0].trim();
  return docs
    .filter((d) => hasHangul(d.place_name) && d.distance <= MAX_DISTANCE_M)
    .map((d) => ({
      ...d,
      ...nameEvidence(base, d.place_name),
      catOk: categoryOk(d, place.type),
    }))
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance);
}

/** applied | review | none, with the reason spelled out for the report. */
function decide(place, ranked) {
  if (ranked.length === 0) return { bucket: "none", why: "no Hangul candidate within 150 m" };
  const best = ranked[0];
  // A runner-up for the SAME brand ("준오헤어 강남역1호점" vs "…2호점") is not
  // an ambiguity about the name — only a different brand is.
  const rival = ranked
    .slice(1)
    .find((r) => nameKey(stripBranch(r.place_name)) !== nameKey(stripBranch(best.place_name)));
  const margin = rival ? best.similarity - rival.similarity : 1;

  // Same-storefront path: an isolated candidate right on our point with an
  // agreeing category. Proximity does most of the work here, but it is not
  // allowed to override the name outright — hand-checking this path with no
  // name floor put 에르아룸 on "HOSU DOSAN", 은자살롱 on "Dears Hair" and
  // 에프에프 on "Onyad Hair" (4 wrong in 16). Near-zero overlap between two
  // substantial names is evidence AGAINST the match, not merely its absence,
  // so the name still has to fail to contradict.
  const byDistance = [...ranked].sort((a, b) => a.distance - b.distance);
  const nearest = byDistance[0];
  const secondNearest = byDistance.find(
    (r) => nameKey(stripBranch(r.place_name)) !== nameKey(stripBranch(nearest.place_name)),
  );
  if (
    nearest.distance <= SAME_STOREFRONT_M &&
    nearest.catOk &&
    nearest.similarity >= REVIEW_SIMILARITY &&
    (!secondNearest || secondNearest.distance >= STOREFRONT_ISOLATION_M)
  ) {
    return {
      bucket: "applied",
      best: nearest,
      rival: secondNearest,
      why: `same storefront — ${nearest.distance} m, category agrees, nothing else within ${STOREFRONT_ISOLATION_M} m (name similarity ${nearest.similarity.toFixed(2)})`,
    };
  }

  if (best.similarity < REVIEW_SIMILARITY) {
    return { bucket: "none", best, why: `best name similarity ${best.similarity.toFixed(2)} — no name evidence` };
  }
  if (best.similarity < AUTO_SIMILARITY) {
    return { bucket: "review", best, rival, why: `similarity ${best.similarity.toFixed(2)} below the ${AUTO_SIMILARITY} auto bar` };
  }
  if (best.shared < MIN_SHARED_BIGRAMS) {
    return { bucket: "review", best, rival, why: `similarity ${best.similarity.toFixed(2)} rests on only ${best.shared} shared bigrams ("${best.keys[0]}" vs "${best.keys[1]}")` };
  }
  if (!best.catOk && best.similarity < STRONG_SIMILARITY) {
    return { bucket: "review", best, rival, why: `category "${best.category_name}" does not corroborate ${place.type} and similarity ${best.similarity.toFixed(2)} < ${STRONG_SIMILARITY}` };
  }
  if (margin < MARGIN) {
    return { bucket: "review", best, rival, why: `ambiguous — "${rival.place_name}" scores ${rival.similarity.toFixed(2)} vs ${best.similarity.toFixed(2)}` };
  }
  return {
    bucket: "applied",
    best,
    rival,
    why: `similarity ${best.similarity.toFixed(2)} at ${best.distance} m${best.catOk ? ", category agrees" : ", name evidence alone"}${rival ? `, next brand ${rival.similarity.toFixed(2)}` : ", only candidate"}`,
  };
}

// ── run ─────────────────────────────────────────────────────
const overrides = existsSync(OVERRIDES_PATH) ? JSON.parse(readFileSync(OVERRIDES_PATH, "utf8")) : {};
const before = Object.keys(overrides).length;
const rows = { applied: [], review: [], none: [] };

// Rows this pass has ruled on before. Keeping them means a re-run reproduces
// the same report instead of an empty one: once a name is applied the row has
// Hangul and stops looking like a target, but the scoring reads `name` (always
// English) so re-deciding it lands in exactly the same bucket.
const decided = existsSync(DECISIONS_PATH) ? JSON.parse(readFileSync(DECISIONS_PATH, "utf8")) : {};

for (const file of FILES) {
  const { places } = readGeneratedPlaces(file);
  const targets = places.filter((p) => !hasHangul(p.nameKr) || decided[p.id]);
  console.log(`${file}: ${targets.length} rows still English`);
  for (const p of targets) {
    const ranked = rank(p, candidatesFor(p));
    const d = decide(p, ranked);
    const row = {
      id: p.id,
      name: p.name.split("|")[0].trim(),
      type: p.type,
      proposed: d.best?.place_name ?? null,
      distance: d.best?.distance ?? null,
      similarity: d.best?.similarity ?? null,
      catOk: d.best?.catOk ?? null,
      rival: d.rival ? `${d.rival.place_name} (${d.rival.similarity.toFixed(2)})` : null,
      why: d.why,
    };
    rows[d.bucket].push(row);
    decided[p.id] = d.bucket;
  }
}
writeFileSync(DECISIONS_PATH, `${JSON.stringify(decided, null, 1)}\n`);

// Two of our rows proposing the SAME Kakao place are, by construction, not
// both right — one of them is a neighbour that scored well. ("Aceumdu by
// Soonsiki Hair" and "Soonsiki Hair Hongdae Hanok Branch" both land on
// 순시키헤어 한옥점 two metres away.) Unless one wins clearly, demote both.
const claims = new Map();
for (const r of rows.applied) {
  if (!claims.has(r.proposed)) claims.set(r.proposed, []);
  claims.get(r.proposed).push(r);
}
for (const [name, list] of claims) {
  if (list.length < 2) continue;
  const ranked = [...list].sort((a, b) => b.similarity - a.similarity || a.distance - b.distance);
  const clearWinner = ranked[0].similarity - ranked[1].similarity >= MARGIN;
  for (const r of ranked.slice(clearWinner ? 1 : 0)) {
    r.why = `contested — ${list.length} places propose "${name}"${clearWinner ? `, and "${ranked[0].name}" scores higher` : " with no clear winner"}`;
    rows.applied.splice(rows.applied.indexOf(r), 1);
    rows.review.push(r);
  }
}

for (const r of rows.applied) {
  overrides[r.id] = r.proposed;
  console.log(`  ✓ ${r.id} → ${r.proposed} — ${r.why}`);
}

// The same check across the MERGED override set, which catches the first
// pass's collisions too. It had given all three of "JUNO HAIR | Myeongdong
// 1st", "| Myeongdong 4th" and "| Myeongdong Art Theater Branch" the name
// 준오헤어 명동4호점 — one of them is right and two are sending a taxi to the
// wrong building. Kakao names one storefront once, so a shared name is proof
// of a bad match; drop all claimants rather than guess which is the real one.
const contested = [];
const byKrName = new Map();
for (const [id, kr] of Object.entries(overrides)) {
  byKrName.set(kr, [...(byKrName.get(kr) ?? []), id]);
}
for (const [kr, ids] of byKrName) {
  if (ids.length < 2) continue;
  for (const id of ids) {
    delete overrides[id];
    contested.push({ id, kr, ids });
    rows.review.push({
      id,
      name: id,
      type: "",
      proposed: kr,
      distance: null,
      similarity: null,
      catOk: null,
      rival: null,
      why: `contested across passes — ${ids.length} places had been given "${kr}" (${ids.join(", ")}); override withdrawn`,
    });
  }
  console.log(`  ✗ withdrew "${kr}" from ${ids.length} places: ${ids.join(", ")}`);
}

/** The nameKr scripts/build-creatrip-places.mjs derives when no override
    applies — needed to undo a withdrawn override without a full rebuild. */
const koreanRun = (s) => (s.match(/[가-힣][가-힣\s·&]*[가-힣]/u) ?? [null])[0];

// ── report ──────────────────────────────────────────────────
const table = (list) =>
  [
    "| id | English name | proposed Korean name | dist | sim | why |",
    "|---|---|---|---|---|---|",
    ...list.map(
      (r) =>
        `| \`${r.id}\` | ${r.name} | ${r.proposed ?? "—"} | ${r.distance ?? "—"}m | ${r.similarity?.toFixed(2) ?? "—"} | ${r.why} |`,
    ),
  ].join("\n");

const report = `# Korean-name backfill, second pass

Generated by \`scripts/backfill-kr-names-2.mjs\`. Widened the first pass's
radius from 100 m to ${MAX_DISTANCE_M} m and added romanized name similarity as the
corroborating signal (auto bar ${AUTO_SIMILARITY}, review floor ${REVIEW_SIMILARITY}, both
calibrated on the 68 matches the first pass already proved).

- **applied: ${rows.applied.length}** — clear single winner with name evidence, written to \`scripts/lib/kr-name-overrides.json\`
- **review: ${rows.review.length}** — plausible but not unambiguous, deliberately left in English
- **no match: ${rows.none.length}** — nothing credible within ${MAX_DISTANCE_M} m
- **withdrawn: ${contested.length}** — a Korean name two or more places had been given, so at
  most one of them was right; all claimants reverted to English (includes first-pass matches)

## Applied

${table(rows.applied)}

## Left for review (NOT applied)

${table(rows.review)}

## No candidate

${table(rows.none)}
`;
writeFileSync(REPORT_PATH, report);

console.log(
  `\napplied ${rows.applied.length}, left for review ${rows.review.length}, no candidate ${rows.none.length}`,
);
console.log(`report: ${REPORT_PATH}`);

if (DRY) {
  console.log("--dry-run: overrides and generated files untouched");
  process.exit(0);
}

const sorted = Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OVERRIDES_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${OVERRIDES_PATH}: ${before} → ${Object.keys(sorted).length} entries`);

for (const file of FILES) {
  const { header, places } = readGeneratedPlaces(file);
  let patched = 0;
  const withdrawn = new Set(contested.map((c) => c.id));
  for (const p of places) {
    if (sorted[p.id] && p.nameKr !== sorted[p.id]) {
      p.nameKr = sorted[p.id];
      patched += 1;
    } else if (withdrawn.has(p.id)) {
      const fallback = koreanRun(p.name) ?? p.name;
      if (p.nameKr !== fallback) {
        p.nameKr = fallback;
        patched += 1;
      }
    }
  }
  if (patched > 0) {
    writeGeneratedPlaces(file, header, places);
    console.log(`${file}: ${patched} nameKr patched`);
  }
}
