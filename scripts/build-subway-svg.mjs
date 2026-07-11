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

// ---------------------------------------------------------------------------
// Task S7 #2: Kakao-style label hierarchy. Every station label gets a size
// bump over its resolved class size (LABEL_SIZE_SCALE), plus a near-black
// fill; transfer/terminus (lbl-major) labels get an additional bump and bold
// weight, so important names read as bigger/darker the way Kakao's map does.
const LABEL_SIZE_SCALE = 1.18; // +18%, inside the requested ~15-20% range
const LABEL_MAJOR_SCALE = 1.1; // +10% on top of the base bump, majors only
const LABEL_FILL_COLOR = "#1a1a1a";

// ---------------------------------------------------------------------------
// Task S7 #1: per-station number-code text on the source map (KRIC 역번호,
// e.g. "222", "S403", "K412", "P157-1") — small alphanumeric codes threaded
// along each line. Confirmed by inspecting scripts/.cache/mapimage.svg: this
// SVG has zero <rect> elements anywhere, and the small <circle>s that sit
// near these codes are station-marker dots (used elsewhere for hit-target
// placement), not a backing "bubble" shape for the code itself — so removing
// the code is just removing this one <text> element, nothing else. Kakao's
// map omits these entirely; this regex distinguishes them from:
//  - numbered-line badges: a lone digit "1".."9" (e.g. cls-19 next to a big
//    colored circle marking where Line 2/6/etc. continues off this map) —
//    excluded by requiring 2+ characters below (\d{2,4}).
//  - real Korean station/legend text — excluded via the Hangul check at the
//    call site (this regex only ever sees non-Korean content).
const STATION_CODE_RE = /^[A-Z]{0,2}\d{2,4}(-\d{1,2})?[A-Z]?$/;

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

  // ---- Task S7 #1: strip per-station number-code text (see STATION_CODE_RE
  // above). Runs first, before any label matching, so it can't interact with
  // the passes below — every removed element is non-Korean and 2+ chars,
  // disjoint from every class actually used for station/legend names or for
  // the single-digit numbered-line badges.
  let removedCodeCount = 0;
  const removedCodeClasses = new Map(); // class -> count, for the build report
  $("text").each((_, el) => {
    const $el = $(el);
    const tspans = $el.find("tspan");
    if (tspans.length === 0) return; // empty placeholder <text/> (some g.cls-14 groups have one)
    const content = tspans
      .toArray()
      .map((t) => $(t).text())
      .join("")
      .trim();
    if (!content || /[가-힣]/.test(content) || !STATION_CODE_RE.test(content)) return;
    const cls = ($el.attr("class") ?? "").trim();
    removedCodeClasses.set(cls, (removedCodeClasses.get(cls) ?? 0) + 1);
    removedCodeCount++;
    $el.remove();
  });

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

  // ---------------------------------------------------------------------------
  // Task S7 follow-up #1: KRIC English names embed long parenthetical
  // disambiguators/former-names ("Yangjae (Seocho-gu Office)", "Dongjak (Seoul
  // National Cemetery)", "Chongshin Univ. (Isu)") — the dominant label-collision
  // driver in dense areas (Kakao's own map uses short primary names only).
  // Derive a short DISPLAY name per station by stripping a trailing " (...)"
  // suffix when the full name is long enough to need it, computed up front for
  // every dataset station (not just ones matched on the map) so the uniqueness
  // check below is stable regardless of match order. The FULL (abbreviated)
  // name is preserved separately as `data-full-name` for a future tooltip, and
  // is also what the dataset/callout/route-strip continue to read via
  // STATIONS.name — this only changes what the map <text> label itself shows.
  const DISPLAY_STRIP_MIN_CHARS = 14;
  // Trailing parenthetical only — e.g. "Ichon (National Museum of Korea)" ->
  // "Ichon" — NOT a mid-string paren like "Jongno 3(sam)ga" (the "(sam)" isn't
  // a disambiguator suffix, it's part of the name itself; the regex's `$`
  // anchor correctly leaves that one alone since it doesn't end in ")").
  const TRAILING_PAREN_SUFFIX_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;

  function stripDisplayCandidate(fullName) {
    if (fullName.length <= DISPLAY_STRIP_MIN_CHARS) return null;
    const m = fullName.match(TRAILING_PAREN_SUFFIX_RE);
    if (!m) return null;
    const base = m[1].trim();
    return base || null;
  }

  // FULL (abbreviated) name for every dataset station — same abbreviate() step
  // as before this change, so `data-full-name` matches what the label used to
  // render pre-fix.
  const fullNameById = new Map();
  for (const id of stationIds) fullNameById.set(id, abbreviate(stations[id].name));

  // Tentative display name: the stripped candidate if the name is long enough
  // and has a trailing parenthetical, else the full name unchanged.
  const tentativeDisplayById = new Map();
  for (const id of stationIds) {
    const full = fullNameById.get(id);
    tentativeDisplayById.set(id, stripDisplayCandidate(full) ?? full);
  }

  // Uniqueness check, against the whole dataset's tentative display names:
  // never let two stations show the same stripped name. Group by tentative
  // name; for any group of 2+, only the stations that actually got stripped
  // (vs. ones whose full name already equals the group name) are candidates
  // to revert — reverting an unstripped one wouldn't resolve anything, it'd
  // just create a different collision. Among stripped colliders, keep the
  // short form on the single most-important one (major: transfer/terminus)
  // and revert every other stripped candidate in the group back to its full
  // name; ties broken by station id ascending for deterministic, idempotent
  // output.
  const byTentative = new Map();
  for (const id of stationIds) {
    const name = tentativeDisplayById.get(id);
    if (!byTentative.has(name)) byTentative.set(name, []);
    byTentative.get(name).push(id);
  }
  const displayNameById = new Map(tentativeDisplayById);
  for (const groupIds of byTentative.values()) {
    if (groupIds.length <= 1) continue;
    const strippedIds = groupIds.filter((id) => tentativeDisplayById.get(id) !== fullNameById.get(id));
    if (strippedIds.length === 0) continue; // coincidental full-name dupe (e.g. Yangpyeong x2) — not from stripping, leave alone

    const unstrippedIds = groupIds.filter((id) => tentativeDisplayById.get(id) === fullNameById.get(id));

    // If the group contains unstripped members, revert ALL stripped members
    // to prevent collision with unstripped members' names. Otherwise, keep the
    // top-ranked stripped member (major: transfer/terminus, else by id ascending)
    // and revert the rest.
    let idsToRevert = [];
    if (unstrippedIds.length > 0) {
      // Stripped member's tentative display name collides with an unstripped
      // member's full (already unstripped) name. Revert all stripped members.
      idsToRevert = strippedIds;
    } else {
      // Only stripped members in this group — keep the most important one.
      const sorted = strippedIds.slice().sort((a, b) => {
        const majorA = isMajor(a) ? 0 : 1;
        const majorB = isMajor(b) ? 0 : 1;
        if (majorA !== majorB) return majorA - majorB;
        return a < b ? -1 : a > b ? 1 : 0;
      });
      idsToRevert = sorted.slice(1);
    }

    for (const id of idsToRevert) {
      displayNameById.set(id, fullNameById.get(id)); // revert to full name
    }
  }

  // Build-time assertion: ensure no display-name collisions where at least one
  // member was stripped this run. Pre-existing collisions (both unstripped, like
  // Yangpyeong/Yangpyeong_5) are allowed.
  const finalDisplayNames = new Map(); // displayName -> [stationIds]
  for (const id of stationIds) {
    const displayName = displayNameById.get(id);
    if (!finalDisplayNames.has(displayName)) {
      finalDisplayNames.set(displayName, []);
    }
    finalDisplayNames.get(displayName).push(id);
  }

  for (const [displayName, ids] of finalDisplayNames.entries()) {
    if (ids.length <= 1) continue;
    // Check if at least one member was stripped this run.
    const hasStripped = ids.some((id) => {
      const tentative = tentativeDisplayById.get(id);
      const full = fullNameById.get(id);
      return tentative !== full; // was stripped at some point
    });

    if (hasStripped) {
      console.error(`[build-subway-svg] FAILED: display-name collision "${displayName}" with at least one stripped member: ${ids.join(", ")}`);
      process.exit(1);
    }
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

    const fullName = fullNameById.get(id);
    const englishName = displayNameById.get(id); // short DISPLAY name — see derivation above
    const major = isMajor(id);

    // Replace all tspans with a single tspan carrying the DISPLAY name,
    // keeping the first tspan's position attributes.
    const first = info.tspans[0];
    const $first = $(first);
    const firstAttribs = { ...first.attribs };
    info.$el.empty();
    const $newTspan = $("<tspan>").attr(firstAttribs).text(englishName);
    info.$el.append($newTspan);

    info.$el.attr("data-label-for", id);
    info.$el.attr("data-full-name", fullName);
    const existingClass = info.$el.attr("class") ?? "";
    const labelClass = major ? "lbl-major" : "lbl-minor";
    info.$el.attr("class", `${existingClass} ${labelClass}`.trim());

    // ---- Task S7 #2: Kakao-style label hierarchy. Resolve *this* label's
    // own class font-size (in px — see parseClassFontSizes() above for why a
    // resolved px, not a CSS percentage, is the right base to scale), bump it
    // by LABEL_SIZE_SCALE, bump majors again by LABEL_MAJOR_SCALE, then apply
    // the existing >12-char shrink on top of that NEW base (not the original
    // class size) so long names still fit.
    //
    // The size is carried inline as a --lbl-fs custom property, NOT a literal
    // `font-size` declaration: a literal inline font-size would always beat
    // the zoom-tier rules in app/globals.css (`[data-zoom="mid"] .lbl-minor`,
    // `[data-zoom="far"] .lbl-major`), freezing every label at its near-tier
    // size when zoomed out. `.subwaywrap .lbl-major/.lbl-minor { font-size:
    // var(--lbl-fs) }` supplies the near-tier size at the SAME specificity
    // those zoom-tier rules already beat, so they still win when zoomed out.
    // fill/font-weight have no such conflict, so they're set directly.
    const finalClassAttr = info.$el.attr("class") ?? "";
    const resolvedPx = resolveLabelFontPx(finalClassAttr, classFontSizes, measuredFallbackPx);
    let sizedPx = resolvedPx * LABEL_SIZE_SCALE;
    if (major) sizedPx *= LABEL_MAJOR_SCALE;
    if (englishName.length > MAX_LABEL_CHARS_BEFORE_SHRINK) sizedPx *= SHRINK_FACTOR;
    const finalPx = Math.round(sizedPx * 100) / 100;
    const styleDecls = [`--lbl-fs:${finalPx}px`, `fill:${LABEL_FILL_COLOR}`];
    if (major) styleDecls.push("font-weight:700");
    const existingStyle = info.$el.attr("style") ?? "";
    info.$el.attr("style", `${existingStyle}${existingStyle ? ";" : ""}${styleDecls.join(";")}`.trim());

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

    // Stash everything Task S7 #3 (label horizontalization, below) needs to
    // estimate this label's box and candidate placements, without recomputing
    // any of it.
    info.major = major;
    info.englishName = englishName;
    info.finalPx = finalPx;
    info.hx = hx;
    info.hy = hy;
    info.circleR = circle ? circle.r : null;
  }
  $("svg").append(hitTargetsEl);

  // ---- Task S7 #3: horizontalize rotated labels where it doesn't collide.
  // Kakao's map keeps station names horizontal except where there's truly no
  // room; this map (inherited from the Sinseiki source) rotates almost every
  // label to cram it into the available space (595 of 606 on first build).
  // Greedy pass, in a fixed deterministic order (lbl-major first, then by
  // station id — so re-running against the same source is idempotent): for
  // each rotated label, try a small set of horizontal candidate placements
  // anchored on the station's own marker; take the first one that doesn't
  // overlap any other label's box or any station dot.
  const HORIZ_CLEARANCE_PAD = 1.5; // gap (map units) between dot edge and label edge
  const HORIZ_BOX_PAD = 0.3; // small buffer so accepted placements aren't flush against a neighbor
  const FALLBACK_DOT_R = 2; // used only if a label has no matched marker circle

  // Axis-aligned box for a horizontal, start/end/middle-anchored label.
  // height/width follow the spec estimate (width = chars*fontSize*0.6, height
  // = fontSize*1.2); the 0.8/0.2 split approximates ascender-above-baseline /
  // descender-below-baseline so a "centered" vertical placement looks right.
  function estimateBox(x, y, width, height, anchor) {
    let left, right;
    if (anchor === "end") {
      left = x - width;
      right = x;
    } else if (anchor === "middle") {
      left = x - width / 2;
      right = x + width / 2;
    } else {
      left = x;
      right = x + width;
    }
    return { left, right, top: y - height * 0.8, bottom: y + height * 0.2 };
  }

  // Conservative AABB for a still-rotated, start-anchored label: rotate its
  // local (0,0)-(width,-height) rect (same 0.8/0.2 split as estimateBox) by
  // the transform's own angle and take the min/max extent. Deliberately not
  // tightened further — an over-estimate here only ever makes us *more*
  // cautious about horizontalizing a neighboring label, never less.
  function rotatedConservativeBox(ax, ay, width, height, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      [0, height * 0.2],
      [width, height * 0.2],
      [width, -height * 0.8],
      [0, -height * 0.8],
    ];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const [lx, ly] of corners) {
      const gx = ax + lx * cos - ly * sin;
      const gy = ay + lx * sin + ly * cos;
      left = Math.min(left, gx);
      right = Math.max(right, gx);
      top = Math.min(top, gy);
      bottom = Math.max(bottom, gy);
    }
    return { left, right, top, bottom };
  }

  function boxesOverlap(a, b, pad) {
    return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  }

  // Station-marker dots — static obstacles, unaffected by this pass. (The
  // transparent r=9 hit-targets aren't in circleEls: that list was captured
  // above, before hit-targets were injected, so they can't self-block a
  // label.)
  const dotObstacles = circleEls.map((c) => ({
    left: c.cx - c.r - 0.5,
    right: c.cx + c.r + 0.5,
    top: c.cy - c.r - 0.5,
    bottom: c.cy + c.r + 0.5,
    circle: c,
  }));

  const horizItems = matched
    .filter((m) => m.info.hx != null && m.info.hy != null)
    .map((m) => {
      const transform = m.info.$el.attr("transform") ?? "";
      const rotateMatch = transform.match(/rotate\(([-\d.]+)/);
      const width = m.info.englishName.length * m.info.finalPx * 0.6;
      const height = m.info.finalPx * 1.2;
      const box = rotateMatch
        ? rotatedConservativeBox(m.info.ax, m.info.ay, width, height, parseFloat(rotateMatch[1]))
        : estimateBox(m.info.ax, m.info.ay, width, height, "start");
      return { m, rotated: Boolean(rotateMatch), width, height, box, ownCircle: m.circle ?? null };
    });

  const alreadyHorizontalCount = horizItems.filter((it) => !it.rotated).length;
  let horizontalizedCount = 0;
  const leftRotatedIds = [];

  const order = horizItems
    .map((_, i) => i)
    .sort((ia, ib) => {
      const a = horizItems[ia].m;
      const b = horizItems[ib].m;
      const majorA = a.info.major ? 0 : 1;
      const majorB = b.info.major ? 0 : 1;
      if (majorA !== majorB) return majorA - majorB;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0; // stable sort preserves original (document) order for true ties
    });

  for (const idx of order) {
    const item = horizItems[idx];
    if (!item.rotated) continue;
    const { m, width, height } = item;
    const hx = m.info.hx;
    const hy = m.info.hy;
    const r = item.ownCircle ? item.ownCircle.r : FALLBACK_DOT_R;
    const clearance = r + HORIZ_CLEARANCE_PAD;

    // Priority order: right, left, above, below — small offsets from the
    // station's own marker, matching the task brief.
    const candidates = [
      { x: hx + clearance, y: hy + height * 0.3, anchor: "start" },
      { x: hx - clearance, y: hy + height * 0.3, anchor: "end" },
      { x: hx, y: hy - clearance - height * 0.2, anchor: "middle" },
      { x: hx, y: hy + clearance + height * 0.8, anchor: "middle" },
    ];

    let chosen = null;
    for (const cand of candidates) {
      const box = estimateBox(cand.x, cand.y, width, height, cand.anchor);
      let collides = false;
      for (let j = 0; j < horizItems.length; j++) {
        if (j === idx) continue;
        if (boxesOverlap(box, horizItems[j].box, HORIZ_BOX_PAD)) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        for (const dot of dotObstacles) {
          if (item.ownCircle && dot.circle === item.ownCircle) continue;
          if (boxesOverlap(box, dot, HORIZ_BOX_PAD)) {
            collides = true;
            break;
          }
        }
      }
      if (!collides) {
        chosen = { ...cand, box };
        break;
      }
    }

    if (chosen) {
      const roundedX = Math.round(chosen.x * 100) / 100;
      const roundedY = Math.round(chosen.y * 100) / 100;
      m.info.$el.attr("transform", `translate(${roundedX} ${roundedY})`);
      if (chosen.anchor === "start") {
        m.info.$el.removeAttr("text-anchor");
      } else {
        m.info.$el.attr("text-anchor", chosen.anchor);
      }
      item.box = chosen.box;
      item.rotated = false;
      horizontalizedCount++;
    } else {
      leftRotatedIds.push(m.id);
    }
  }

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
  (transfer/terminus) or "lbl-minor" for zoom-tier CSS. Kakao-style pass
  (Task S7): per-station number-code text (e.g. "222", "S403") stripped;
  every label carries an inline --lbl-fs custom property (near-tier size,
  read by .lbl-major/.lbl-minor in app/globals.css) plus a near-black fill,
  with majors additionally bold; rotated labels are straightened to
  horizontal wherever a collision-free spot exists near their marker. Follow-up:
  labels show a short DISPLAY name (trailing " (...)" parenthetical stripped
  when the full name is long, unless that would collide with another
  station's display name); the full (abbreviated) name is preserved as
  data-full-name for a future tooltip. Dataset/callout/route-strip are
  unaffected — they read STATIONS.name (full name) directly.

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

  console.log(`\nTask S7 #1 — station-number-code text removed: ${removedCodeCount}`);
  for (const [cls, count] of [...removedCodeClasses.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls}: ${count}`);
  }

  const strippedDisplayIds = stationIds.filter((id) => displayNameById.get(id) !== fullNameById.get(id));
  const revertedCollisionIds = stationIds.filter(
    (id) => tentativeDisplayById.get(id) !== fullNameById.get(id) && displayNameById.get(id) === fullNameById.get(id),
  );
  console.log(`\nDisplay-name shortening (parenthetical-suffix strip) — stations with a shortened label: ${strippedDisplayIds.length} / ${totalDatasetStations}`);
  if (revertedCollisionIds.length) {
    console.log(`  reverted to full name due to a display-name collision: ${revertedCollisionIds.join(", ")}`);
  }

  console.log(`\nTask S7 #3 — label horizontalization:`);
  console.log(`  already horizontal: ${alreadyHorizontalCount}`);
  console.log(`  horizontalized this run: ${horizontalizedCount}`);
  console.log(`  left rotated (no collision-free placement found): ${leftRotatedIds.length}`);
  const BEAUTY_ZONE_STATIONS = {
    gangnam: ["gangnam", "nonhyeon", "yeoksam", "seolleung", "samseong_world_trade_center_seoul", "gangnamgu_office", "sinnonhyeon"],
    hongdae: ["hongik_univ", "sinchon", "hapjeong", "sangsu"],
    myeongdong: ["myeongdong", "euljiro_1_il_ga", "euljiro_3_sam_ga", "euljiro_4_sa_ga", "city_hall"],
    apgujeong: ["apgujeong", "apgujeong_rodeo", "sinsa"],
    cheongdam: ["cheongdam"],
    seongsu: ["seongsu", "ttukseom"],
  };
  const leftRotatedSet = new Set(leftRotatedIds);
  for (const [zone, ids] of Object.entries(BEAUTY_ZONE_STATIONS)) {
    const stillRotated = ids.filter((id) => leftRotatedSet.has(id));
    if (stillRotated.length) {
      console.log(`  still rotated in ${zone} corridor: ${stillRotated.join(", ")}`);
    }
  }

  if (wiredRatio <= 0.97) {
    console.error(`[build-subway-svg] FAILED: wired ratio ${(wiredRatio * 100).toFixed(2)}% <= 97% threshold.`);
    process.exit(1);
  }

  console.log("[build-subway-svg] done.");
}

main();
