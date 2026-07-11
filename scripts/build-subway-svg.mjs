#!/usr/bin/env node
// Build the processed Seoul metro SVG: swap Korean station-name labels for
// English (KRIC) names, and inject a transparent per-station hit target
// (data-station="<id>") at each matched station's marker location.
//
// Source: scripts/.cache/mapimage.svg — Sinseiki/opensource-seoul-subway-map
// (MIT license), fetched by scripts/fetch-subway-sources.mjs.
// https://github.com/Sinseiki/opensource-seoul-subway-map
//
// Outputs (both committed):
//   components/subway/seoul-metro.svg — readable processed SVG artifact
//   components/subway/metro-svg.ts    — same content wrapped as `export const METRO_SVG`,
//                                        consumed by the Task S4 client map component.
//
// Run via `npm run build:subway-svg` (chains the fetch step first).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import data from "../lib/subway-data.json" with { type: "json" };
import { normalizeStationNameKr } from "./lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SVG_SOURCE = path.join(ROOT, "scripts/.cache/mapimage.svg");
const OUT_SVG = path.join(ROOT, "components/subway/seoul-metro.svg");
const OUT_TS = path.join(ROOT, "components/subway/metro-svg.ts");

const SOURCE_URL =
  "https://raw.githubusercontent.com/Sinseiki/opensource-seoul-subway-map/master/mapimage.svg";

// ---------------------------------------------------------------------------
// Stations present in the dataset but not drawn on the Sinseiki map (e.g.
// post-map-vintage openings, or stations the source diagram omits). Excluded
// from the "wired" denominator used by the 97% gate and reported separately.
// ---------------------------------------------------------------------------
const SVG_SKIP = new Set([
  // (populate as discovered below; kept here so the list is easy to find/edit)
]);

// ---------------------------------------------------------------------------
// Manual disambiguation / correction table for labels the automatic matcher
// cannot resolve confidently (duplicate normalized names, OCR-adjacent typos
// in the source map, etc). Maps a normalized-Korean-label occurrence (by
// index among occurrences of that name, in document order) to a station id.
// Most entries are simple 1:1 (single occurrence -> single station).
// ---------------------------------------------------------------------------
const MANUAL_SVG_MAP = {
  // "양평" appears twice in the dataset (Line 5 vs Gyeongui-Jungang) but only
  // once distinctly-labeled-twice on the map at two different locations; both
  // map labels are legitimate — disambiguated by nearest-neighbor proximity
  // in the main pass. No manual override needed unless that heuristic fails.
};

const MAX_LABEL_CHARS_BEFORE_SHRINK = 12;
const SHRINK_FACTOR = 0.9;
// Fallback resolved font-size (px) used only if a label's class font-size
// can't be determined from the stylesheet at all (defensive; the source map
// has always defined a size for every label class observed so far).
const FALLBACK_LABEL_FONT_PX = 4;
const ABBREVIATIONS = [
  [/\bStation\b/g, "Stn."],
  [/\bUniversity\b/g, "Univ."],
];

function abbreviate(name) {
  let out = name;
  for (const [re, rep] of ABBREVIATIONS) out = out.replace(re, rep);
  return out;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// ---------------------------------------------------------------------------
// Resolve each CSS class's effective font-size (in px) from the SVG's inline
// <style> block. The stylesheet groups selectors like
// `.cls-1, .cls-2, .cls-3 { font-size: 1.5px; }` — every class named in the
// comma-separated selector list gets that declaration's font-size. Later
// rules win on ties (last-applies-wins, mirroring CSS cascade order for
// same-specificity class selectors declared later in the sheet).
//
// This replaces the previous `style="font-size:90%"` approach: a percentage
// on an element resolves against the *inherited* (parent's computed) font
// size, not the class rule applied to that same element — so on this SVG
// (root font-size ~16px, no ancestor <text>/tspan setting font-size) a "90%"
// label actually rendered at ~14.4px, ~2.5x-6x larger than the ~2.7-6px class
// sizes used across labels. Resolving the class's own px size first and
// scaling *that* keeps the shrunk label proportionate to its real size.
function parseClassFontSizes(styleText) {
  const sizes = new Map();
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(styleText))) {
    const selectors = m[1];
    const body = m[2];
    const fontSizeMatch = body.match(/font-size:\s*([\d.]+)px/);
    if (!fontSizeMatch) continue;
    const px = parseFloat(fontSizeMatch[1]);
    for (const sel of selectors.split(",")) {
      const trimmed = sel.trim();
      const classMatch = trimmed.match(/^\.(cls-\d+)$/);
      if (classMatch) sizes.set(classMatch[1], px);
    }
  }
  return sizes;
}

// Resolve a label's own effective font-size in px, given its `class`
// attribute value (e.g. "cls-40 lbl-major") and the class->px map above.
// Only `cls-N` classes carry font-size rules on this map; `lbl-major`/
// `lbl-minor` are zoom-tier CSS added by this script, not size rules.
function resolveLabelFontPx(classAttr, classSizes, fallbackPx) {
  const classes = (classAttr ?? "").split(/\s+/).filter(Boolean);
  for (const c of classes) {
    if (classSizes.has(c)) return classSizes.get(c);
  }
  return fallbackPx;
}

function main() {
  if (!existsSync(SVG_SOURCE)) {
    console.error(`[build-subway-svg] source not found: ${SVG_SOURCE}`);
    console.error("[build-subway-svg] run `npm run build:subway-svg` (fetch step first) or `node scripts/fetch-subway-sources.mjs`.");
    process.exit(1);
  }

  const raw = readFileSync(SVG_SOURCE, "utf8");
  const $ = cheerio.load(raw, { xmlMode: true });

  // Resolve every `.cls-N` class's font-size (px) up front from the internal
  // <style> block, so label shrinking below can scale each label's *actual*
  // resolved size rather than a percentage of the inherited (root) size.
  const styleText = $("style").text();
  const classFontSizes = parseClassFontSizes(styleText);
  // Fallback: the modal (most common) class font-size across all label-like
  // classes actually used by station labels on this map (cls-40, per the
  // matcher below) — used only if a given label's class is somehow absent
  // from the stylesheet (defensive; not expected in practice).
  const measuredFallbackPx = classFontSizes.get("cls-40") ?? FALLBACK_LABEL_FONT_PX;

  const stations = data.stations;
  const stationIds = Object.keys(stations);

  // Group stations by normalized Korean name for duplicate-name detection.
  const byNormName = new Map();
  for (const id of stationIds) {
    const norm = normalizeStationNameKr(stations[id].nameKr);
    if (!byNormName.has(norm)) byNormName.set(norm, []);
    byNormName.get(norm).push(id);
  }

  // "Major" (transfer or line-terminus) stations get lbl-major; the rest lbl-minor.
  const degree = new Map(); // `${station}|${line}` -> count, to find per-line endpoints
  for (const [a, b, line] of data.edges) {
    degree.set(`${a}|${line}`, (degree.get(`${a}|${line}`) ?? 0) + 1);
    degree.set(`${b}|${line}`, (degree.get(`${b}|${line}`) ?? 0) + 1);
  }
  function isTerminus(id) {
    return stations[id].lines.some((line) => (degree.get(`${id}|${line}`) ?? 0) <= 1);
  }
  function isMajor(id) {
    return stations[id].transfer || isTerminus(id);
  }

  // ---- Pass 1: collect all label <text> elements bearing a single, complete
  // Korean station-like name (cls-40 is the dominant station-label class on
  // this map; other classes carry incidental Korean in legend/terminal text,
  // so we match by *content* against the dataset rather than by class).
  //
  // Two label shapes exist on this map:
  //  (a) a single <text> with one (or more) <tspan>s holding the full name.
  //  (b) a multi-line label split across SIBLING <text> elements wrapped in
  //      <g class="cls-14">...</g> — e.g. "가산" + "디지털단지" as two
  //      separate <text> children rather than two <tspan>s in one <text>.
  //      These must be concatenated to reconstruct the full station name.
  //
  // A small number of labels also use a "current(former)" parenthetical
  // format, e.g. "이수(총신대입구)" — if the full text doesn't match any
  // dataset station, we also try matching the parenthetical's inner text.
  function anchorCoords($el) {
    const transform = $el.attr("transform") ?? "";
    const m = transform.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);
    return { ax: m ? parseFloat(m[1]) : null, ay: m ? parseFloat(m[2]) : null };
  }

  function resolveNorm(rawText) {
    const trimmed = rawText.trim();
    const direct = normalizeStationNameKr(trimmed);
    if (byNormName.has(direct)) return direct;
    const parenInner = trimmed.match(/\(([^)]+)\)/);
    if (parenInner) {
      const inner = normalizeStationNameKr(parenInner[1]);
      if (byNormName.has(inner)) return inner;
    }
    return direct; // may still be non-empty but unmatched — reported as unmatched later
  }

  const textEls = $("text").toArray();
  const consumedTextEls = new Set(); // texts already folded into a g.cls-14 group
  const labelInfos = [];

  // (a) grouped multi-line labels: <g class="cls-14"> wrapping 2+ <text>.
  $("g.cls-14").each((_, gEl) => {
    const $g = $(gEl);
    const children = $g.find("> text").toArray();
    if (children.length < 2) return;
    const joined = children.map((t) => $(t).text().trim()).join("");
    if (!/[가-힣]/.test(joined)) return; // not Korean station text (e.g. glyph paths)
    const norm = resolveNorm(joined);
    if (!norm || !byNormName.has(norm)) return; // legend/line-name text — leave alone

    const first = children[0];
    const $first = $(first);
    const tspans = $first.find("tspan");
    if (tspans.length === 0) return;
    const { ax, ay } = anchorCoords($first);
    for (const t of children) consumedTextEls.add(t);
    labelInfos.push({
      el: first,
      $el: $first,
      norm,
      ax,
      ay,
      tspans: tspans.toArray(),
      extraEls: children.slice(1), // sibling <text>s to remove once matched
    });
  });

  // (b) single <text> labels (not already folded into a group above).
  for (const el of textEls) {
    if (consumedTextEls.has(el)) continue;
    const $el = $(el);
    const tspans = $el.find("tspan");
    if (tspans.length === 0) continue;
    const text = tspans
      .toArray()
      .map((t) => $(t).text())
      .join("");
    if (!/[가-힣]/.test(text)) continue;
    const norm = resolveNorm(text);
    if (!norm || !byNormName.has(norm)) continue; // not a dataset station name — leave alone

    const { ax, ay } = anchorCoords($el);
    labelInfos.push({ el, $el, norm, ax, ay, tspans: tspans.toArray(), extraEls: [] });
  }

  // ---- Pass 2: collect all marker circles with position + radius, for
  // nearest-circle hit-target placement.
  const circleEls = $("circle")
    .toArray()
    .map((el) => {
      const $el = $(el);
      return {
        el,
        $el,
        cx: parseFloat($el.attr("cx")),
        cy: parseFloat($el.attr("cy")),
        r: parseFloat($el.attr("r")),
      };
    })
    .filter((c) => Number.isFinite(c.cx) && Number.isFinite(c.cy));

  function nearestCircle(ax, ay, maxDist = 30) {
    let best = null;
    let bestD = Infinity;
    for (const c of circleEls) {
      const d = dist(ax, ay, c.cx, c.cy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return bestD <= maxDist ? best : null;
  }

  // ---- Matching: assign each label occurrence to a station id.
  // - unique normalized name in dataset -> every occurrence maps to that id
  //   (handles cases like 신촌, where one merged dataset station has two
  //   physically distinct map labels/markers).
  // - duplicate normalized name (dataset has >1 station with that name) ->
  //   resolve by nearest already-matched-neighbor proximity, else MANUAL_SVG_MAP,
  //   else leave unmatched (reported).
  const matched = []; // { labelInfo, id, circle }
  const unmatchedLabels = [];
  const usedCircles = new Set();

  function claimCircle(ax, ay) {
    // nearest unclaimed circle within range; falls back to nearest even if
    // claimed only when nothing unclaimed is in range (rare, dense stations).
    let best = null;
    let bestD = Infinity;
    for (const c of circleEls) {
      if (usedCircles.has(c)) continue;
      const d = dist(ax, ay, c.cx, c.cy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best && bestD <= 30) return best;
    return nearestCircle(ax, ay);
  }

  // First pass: unique-name labels (unambiguous), so their positions are
  // available as "already matched neighbors" for the ambiguous pass.
  const ambiguous = [];
  for (const info of labelInfos) {
    const candidates = byNormName.get(info.norm);
    if (candidates.length === 1) {
      const circle = info.ax != null ? claimCircle(info.ax, info.ay) : null;
      if (circle) usedCircles.add(circle);
      matched.push({ info, id: candidates[0], circle });
    } else {
      ambiguous.push(info);
    }
  }

  // Second pass: ambiguous (duplicate-name) labels — proximity to already
  // matched neighbor stations' dataset lat/lng is not meaningful (different
  // coordinate systems), so we disambiguate by MANUAL_SVG_MAP first, then by
  // nearest-matched-label-of-either-candidate as a last resort (keeps stable,
  // deterministic behavior even though it's an approximation).
  for (const info of ambiguous) {
    const candidates = byNormName.get(info.norm);
    const manualId = MANUAL_SVG_MAP[info.norm];
    let chosenId = null;
    if (manualId && candidates.includes(manualId)) {
      chosenId = manualId;
    } else if (info.ax != null) {
      // Pick whichever candidate doesn't already have a matched label at a
      // near-identical position (avoids assigning both physical labels to
      // the same candidate when the dataset actually has two distinct ids).
      const already = new Map(candidates.map((id) => [id, matched.filter((m) => m.id === id).length]));
      const leastUsed = candidates.slice().sort((a, b) => (already.get(a) ?? 0) - (already.get(b) ?? 0))[0];
      chosenId = leastUsed;
    } else {
      chosenId = candidates[0];
    }
    if (chosenId) {
      const circle = info.ax != null ? claimCircle(info.ax, info.ay) : null;
      if (circle) usedCircles.add(circle);
      matched.push({ info, id: chosenId, circle });
    } else {
      unmatchedLabels.push(info);
    }
  }

  // ---- Apply swaps + hit targets.
  const wiredIds = new Set();
  const hitTargetsEl = $("<g>").attr("id", "hit-targets");
  for (const { info, id, circle } of matched) {
    const station = stations[id];
    if (!station) continue;
    wiredIds.add(id);

    let englishName = abbreviate(station.name);
    const major = isMajor(id);

    // Replace all tspans with a single tspan carrying the English name,
    // keeping the first tspan's position attributes.
    const first = info.tspans[0];
    const $first = $(first);
    const firstAttribs = { ...first.attribs };
    info.$el.empty();
    const $newTspan = $("<tspan>").attr(firstAttribs).text(englishName);
    info.$el.append($newTspan);

    info.$el.attr("data-label-for", id);
    const existingClass = info.$el.attr("class") ?? "";
    const labelClass = major ? "lbl-major" : "lbl-minor";
    info.$el.attr("class", `${existingClass} ${labelClass}`.trim());
    if (englishName.length > MAX_LABEL_CHARS_BEFORE_SHRINK) {
      // Resolve *this* label's own class font-size (in px) and shrink that —
      // not a percentage, which would resolve against the inherited/root
      // font-size instead of the class rule on this same element. See
      // parseClassFontSizes() above for why.
      const finalClassAttr = info.$el.attr("class") ?? "";
      const resolvedPx = resolveLabelFontPx(finalClassAttr, classFontSizes, measuredFallbackPx);
      const shrunkPx = Math.round(resolvedPx * SHRINK_FACTOR * 100) / 100;
      const existingStyle = info.$el.attr("style") ?? "";
      info.$el.attr("style", `${existingStyle}${existingStyle ? ";" : ""}font-size:${shrunkPx}px`.trim());
    }

    // Grouped multi-line labels (g.cls-14): remove the now-redundant sibling
    // <text> elements that used to carry the second/third visual line of the
    // Korean name, so no orphan Korean text remains next to the swapped label.
    for (const extra of info.extraEls ?? []) {
      $(extra).remove();
    }

    // Hit target: transparent circle at the marker (or label anchor if no
    // marker circle was found nearby).
    const hx = circle ? circle.cx : info.ax;
    const hy = circle ? circle.cy : info.ay;
    if (hx != null && hy != null) {
      const hit = $("<circle>")
        .attr("data-station", id)
        .attr("cx", hx)
        .attr("cy", hy)
        .attr("r", 9)
        .attr("fill", "transparent")
        .attr("style", "pointer-events:all");
      hitTargetsEl.append(hit);
    }
  }
  $("svg").append(hitTargetsEl);

  // ---- SVG_SKIP: dataset stations legitimately absent from this map.
  const unwired = stationIds.filter((id) => !wiredIds.has(id) && !SVG_SKIP.has(id));
  const skipButPresent = stationIds.filter((id) => SVG_SKIP.has(id) && wiredIds.has(id));

  // ---- Remaining Korean text: any real map label (station or otherwise)
  // that never got a data-label-for swap, so its Korean text is still on the
  // map. Reported for review — some are legend/line-name text (not stations,
  // fine to leave), some are real stations on lines outside this app's
  // 20-line dataset scope (Gyeonggi regional extensions, EverLine, LRTs).
  const matchedTextEls = new Set(matched.map((m) => m.info.el));
  const remainingKorean = [];
  $("text").each((_, el) => {
    if (matchedTextEls.has(el)) return;
    const $el = $(el);
    const text = $el.find("tspan").toArray().map((t) => $(t).text()).join("").trim();
    if (/[가-힣]/.test(text)) remainingKorean.push(text);
  });

  // ---- Header comment (MIT notice + provenance).
  const header = `<!--
  Seoul metropolitan subway map — processed for essenly.

  Base map: mapimage.svg from Sinseiki/opensource-seoul-subway-map
  https://github.com/Sinseiki/opensource-seoul-subway-map (MIT License)

  Processing: scripts/build-subway-svg.mjs — station labels swapped from
  Korean to English (KRIC official romanization, lib/subway-data.json),
  transparent per-station hit targets (attribute data-station, value = station
  id, r=9) injected at each matched station's marker coordinates. Labels carry
  a data-label-for attribute (value = station id) and class="lbl-major"
  (transfer/terminus) or "lbl-minor" for zoom-tier CSS.

  Source of the base SVG: ${SOURCE_URL}
-->
`;

  let output = $.xml();
  // cheerio's xmlMode serializer re-emits the doctype/xml prolog handling
  // differently; make sure we keep a clean <?xml ...?> + header comment.
  if (!/^<\?xml/.test(output)) {
    output = `<?xml version="1.0" encoding="UTF-8"?>\n${output}`;
  }
  output = output.replace(/(<\?xml[^>]*\?>\s*)/, `$1${header}`);

  // cheerio's xmlMode serializer numeric-escapes all non-ASCII (e.g. the
  // remaining Korean legend/out-of-scope-station text becomes "&#xc218;..."),
  // which is valid XML but defeats the "readable artifact" goal and bloats
  // diffs. Decode plain numeric character references back to literal UTF-8 —
  // safe here since the source has no literal "&#..." text to collide with.
  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  output = output.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

  mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  writeFileSync(OUT_SVG, output, "utf8");

  const tsContent = `/* eslint-disable */
// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-subway-svg.mjs from scripts/.cache/mapimage.svg
// (Sinseiki/opensource-seoul-subway-map, MIT License).
// Regenerate with: npm run build:subway-svg

export const METRO_SVG: string = ${JSON.stringify(output)};
`;
  writeFileSync(OUT_TS, tsContent, "utf8");

  // ---- Matching report.
  const totalDatasetStations = stationIds.length;
  const wiredCount = wiredIds.size;
  const wiredRatio = wiredCount / (totalDatasetStations - SVG_SKIP.size);

  console.log("=== Subway SVG build report ===");
  console.log(`Total <text> labels scanned: ${textEls.length}`);
  console.log(`Dataset stations: ${totalDatasetStations}`);
  console.log(`Matched station labels (label occurrences): ${matched.length}`);
  console.log(`Wired stations (data-station present): ${wiredCount} / ${totalDatasetStations}`);
  console.log(`SVG_SKIP (explicit, excluded from gate): ${SVG_SKIP.size}`);
  if (skipButPresent.length) {
    console.log(`  NOTE: ${skipButPresent.length} SVG_SKIP entries were actually matched anyway: ${skipButPresent.join(", ")}`);
  }
  console.log(`Unwired dataset stations (excl. SVG_SKIP): ${unwired.length}`);
  if (unwired.length) {
    console.log(`  ${unwired.join(", ")}`);
  }
  console.log(`Unmatched map labels (Korean text with no dataset match / ambiguous with no id): ${unmatchedLabels.length}`);
  for (const u of unmatchedLabels) {
    console.log(`  "${u.norm}" at (${u.ax}, ${u.ay})`);
  }
  console.log(`Remaining Korean text on the map (any label not swapped — legend/line-name text or real stations outside this app's 20-line dataset scope): ${remainingKorean.length}`);
  for (const t of remainingKorean) {
    console.log(`  "${t}"`);
  }
  console.log(`Wired ratio (excl. SVG_SKIP): ${(wiredRatio * 100).toFixed(2)}%`);

  if (wiredRatio <= 0.97) {
    console.error(`[build-subway-svg] FAILED: wired ratio ${(wiredRatio * 100).toFixed(2)}% <= 97% threshold.`);
    process.exit(1);
  }

  console.log("[build-subway-svg] done.");
}

main();
