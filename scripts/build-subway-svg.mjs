#!/usr/bin/env node
// Build the processed Seoul metro SVG: tag each Wikimedia base-map English
// station label with its lib/subway-data.json station id (data-label-for),
// and inject a transparent per-station hit target (data-station="<id>") at
// each matched station's marker location.
//
// Source: scripts/.cache/seoul-linemap-en.svg — Wikimedia Commons
// "Seoul_subway_linemap_en.svg" (file IRTC1015, PD-self / public domain),
// fetched by scripts/fetch-subway-sources.mjs.
// https://commons.wikimedia.org/wiki/File:Seoul_subway_linemap_en.svg
//
// Outputs (both committed):
//   components/subway/seoul-metro.svg — readable processed SVG artifact
//   components/subway/metro-svg.ts    — same content wrapped as `export const METRO_SVG`,
//                                        consumed by the client map component.
//
// Run via `npm run build:subway-svg` (chains the fetch step first).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import data from "../lib/subway-data.json" with { type: "json" };
import { normalizeStationNameEn, TRAILING_PAREN_SUFFIX_RE, splitMiddotName } from "./lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SVG_SOURCE = path.join(ROOT, "scripts/.cache/seoul-linemap-en.svg");
const OUT_SVG = path.join(ROOT, "components/subway/seoul-metro.svg");
const OUT_TS = path.join(ROOT, "components/subway/metro-svg.ts");

const SOURCE_URL = "https://upload.wikimedia.org/wikipedia/commons/2/2f/Seoul_subway_linemap_en.svg";
const SOURCE_PAGE_URL = "https://commons.wikimedia.org/wiki/File:Seoul_subway_linemap_en.svg";

// ---------------------------------------------------------------------------
// Stations present in the dataset but not drawn on this map. Excluded from
// the "wired" denominator used by the gate and reported separately. (Empty —
// every dataset station has been matched to a label on this map so far; kept
// here so a future long-tail gap has an obvious place to be recorded.)
// ---------------------------------------------------------------------------
const SVG_SKIP = new Set([]);

// ---------------------------------------------------------------------------
// Ambiguous-name disambiguation: lib/subway-data.json has exactly one
// genuine duplicate normalized English name — "Yangpyeong" (two real,
// distinct stations: one far east on the Gyeongui-Jungang line extension,
// one in western Seoul on Line 5) — and the map draws two distinct
// "Yangpyeong" labels for them. Resolved by document occurrence order (the
// map's 1st "Yangpyeong" label is the Line 5 station at x≈2484, the 2nd is
// the Gyeongui-Jungang one at x≈5395 — confirmed by their neighboring
// station labels, e.g. "Omokgyo"/"Hapjeong" vs "Yongmun"/"Paldang").
// ---------------------------------------------------------------------------
const MANUAL_SVG_MAP = {
  yangpyeong: ["yangpyeong_5", "yangpyeong"],
};

// ---------------------------------------------------------------------------
// Alternate label text actually drawn on this Wikimedia map for a handful of
// dataset stations whose KRIC-derived `name` differs by more than
// abbreviation/punctuation style — typos on the map's own English labels
// (Mukajae/Muakjae, Shinjung-dong/Sinjung-dong — a McCune-Reischauer-style
// "Shin" vs the dataset's Revised-Romanization "Sin", Racecource/Racecourse,
// Curture/Culture, Yangchon/Yangcheon), a translated middle word (Central vs
// Jungang), a plural/word-choice mismatch (Citizen vs Citizens, Western
// Women's vs West Woman's), a different generic word (Park vs Complex), or a
// dataset-side typo the map's label doesn't share ("Millitary" in
// lib/subway-data.json vs the map's correctly-spelled "Military"). Each is
// registered as an extra tier-1 match key for that station id, verified by
// hand against the source SVG (see docs in the W1 report for the exact
// <text>/<tspan> each came from).
// ---------------------------------------------------------------------------
const EXTRA_DATASET_NAME_ALIASES = {
  arts_center: ["Curture & Arts Center"],
  gajeong_jungang_market: ["Gajeong Central Market"],
  west_woman_s_community_center: ["Western Women's Community Center"],
  juan_national_industrial_complex: ["Juan Nat'l Industrial Park"],
  citizens_park: ["Citizen Park"],
  muakjae: ["Mukajae"],
  seoul_racecourse_park: ["Seoul Racecource Park"],
  sinjung_dong: ["Shinjung-dong"],
  yangcheon_hyanggyo: ["Yangchon Hyanggyo"],
  seoul_regional_office_of_millitary_manpower: ["Seoul Regional Office of Military Manpower"],
};

// ---------------------------------------------------------------------------
// Exact label texts that must NEVER be treated as a station match, because
// they are real places outside this app's 20-line dataset scope that happen
// to collide — via a generic name fragment — with an in-scope dataset
// station's name. Confirmed for each by inspecting the label's own
// coordinates and its neighboring labels on the map (all sit thousands of
// map-units from the in-scope station they'd otherwise match):
//  - "City Hall·Yongin Univ." / "Jeondae·Everland": this map combines two
//    place names into one label with a middot (·) in exactly these two
//    spots, both on the Yongin EverLine. Splitting on the middot (per the
//    general splitMiddotName() matching strategy below) would otherwise
//    spuriously match "City Hall·Yongin Univ."'s "City Hall" half to the
//    real, unrelated Seoul "City Hall" interchange (~2500 map-units away).
//  - "Myongji Univ.": Myongji University's actual Yongin-campus EverLine
//    stop, sitting in that same Yongin EverLine cluster (next to "Bopyeong"/
//    "Gimnyangjang"/"Jeondae·Everland") — ~3975 map-units from the real
//    Seoul Line 6 "Jeungsan (Myongji Univ.)" station it would otherwise
//    spuriously match via that dataset station's parenthetical alias.
// ---------------------------------------------------------------------------
const KNOWN_OFF_SCOPE_LABEL_TEXT = new Set([
  "City Hall·Yongin Univ.",
  "Jeondae·Everland",
  "Myongji Univ.",
]);

const MAX_LABEL_CHARS_BEFORE_SHRINK = 12;
const SHRINK_FACTOR = 0.9;
// Fallback resolved font-size (px) used only if a label's class font-size
// can't be determined from the stylesheet at all (defensive; the source map
// has always defined a size for every label class observed so far).
const FALLBACK_LABEL_FONT_PX = 18;

// ---------------------------------------------------------------------------
// Kakao-style label hierarchy (carried over from the previous base map):
// every station label gets a size bump over its resolved class size
// (LABEL_SIZE_SCALE), plus a near-black fill; transfer/terminus (lbl-major)
// labels get an additional bump and bold weight.
const LABEL_SIZE_SCALE = 1.18;
const LABEL_MAJOR_SCALE = 1.1;
const LABEL_FILL_COLOR = "#1a1a1a";

// ---------------------------------------------------------------------------
// Per-station number-code text (KRIC 역번호, e.g. "222", "S403") doesn't
// exist as a distinct text element on this map — station identity comes from
// the 환승역 <use> roundels and route-line ticks, not a printed code — so
// this pass is expected to be a no-op here (verified: 0 matches against the
// current source). Kept (rather than deleted) as a defensive no-op in case a
// future re-render of this map ever adds per-station codes.
const STATION_CODE_RE = /^[A-Z]{0,2}\d{2,4}(-\d{1,2})?[A-Z]?$/;

// ---------------------------------------------------------------------------
// Tap-target marker synthesis: nearest-marker search radius (map units,
// viewBox 0 0 5724 6516). Chosen from the actual label-to-marker distance
// distribution on this map (p90 ≈ 125, p99 ≈ 155, max ≈ 160 for every label
// that resolves to *some* marker within range) — comfortably covers the
// overwhelming majority of matched labels while still being tight enough to
// not misattribute a marker across a dense cluster of nearby stations.
const MAX_MARKER_CLAIM_DIST = 160;
// Approximate radius (map units) of the two marker kinds, used only as
// collision-clearance padding for the horizontalization pass below — this
// map has no per-station body <circle> (see header comment), so these are
// deliberately approximate, not measured geometry.
const TRANSFER_MARKER_R = 11; // 환승역 <use>: local r=2.75 scaled by its own matrix(4 0 0 -4 ...)
const TICK_MARKER_R = 8; // <line> tick marks have no inherent radius; small constant clearance

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// ---------------------------------------------------------------------------
// Resolve each CSS class's effective font-size (in px) from the SVG's inline
// <style> block. This map's stylesheet uses a `st-N` class scheme (e.g.
// `.st50 { font-size: 18px }`) rather than the previous base map's `cls-N`
// scheme — every station label carries class="st49 st50" (st49 = font
// family only, st50 = the 18px size actually used by every real station
// label on this map; a second size-bearing class, st52/20px, is defined but
// never referenced by any element).
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
      const classMatch = trimmed.match(/^\.(st\d+)$/);
      if (classMatch) sizes.set(classMatch[1], px);
    }
  }
  return sizes;
}

// Resolve a label's own effective font-size in px, given its `class`
// attribute value (e.g. "st49 st50") and the class->px map above.
function resolveLabelFontPx(classAttr, classSizes, fallbackPx) {
  const classes = (classAttr ?? "").split(/\s+/).filter(Boolean);
  for (const c of classes) {
    if (classSizes.has(c)) return classSizes.get(c);
  }
  return fallbackPx;
}

// Parse an SVG transform="matrix(a b c d e f)" attribute into its components.
// Every label on this map is positioned via a literal matrix (either the
// identity-ish `matrix(1 0 0 1 x y)` for the ~40 already-horizontal labels,
// or a ~-45° rotation `matrix(0.7071 -0.7071 0.7071 0.7071 x y)` for nearly
// all the rest) rather than a `translate()+rotate()` composition.
function parseMatrixTransform(transformAttr) {
  const m = (transformAttr ?? "").match(
    /matrix\(([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)[ ,]+([-\d.eE]+)\)/,
  );
  if (!m) return null;
  return { a: +m[1], b: +m[2], c: +m[3], d: +m[4], x: +m[5], y: +m[6] };
}

function isIdentityRotation(mtx) {
  return Math.abs(mtx.a - 1) < 1e-3 && Math.abs(mtx.b) < 1e-3 && Math.abs(mtx.c) < 1e-3 && Math.abs(mtx.d - 1) < 1e-3;
}

function main() {
  if (!existsSync(SVG_SOURCE)) {
    console.error(`[build-subway-svg] source not found: ${SVG_SOURCE}`);
    console.error("[build-subway-svg] run `npm run build:subway-svg` (fetch step first) or `node scripts/fetch-subway-sources.mjs`.");
    process.exit(1);
  }

  const raw = readFileSync(SVG_SOURCE, "utf8");
  const $ = cheerio.load(raw, { xmlMode: true });

  const styleText = $("style").text();
  const classFontSizes = parseClassFontSizes(styleText);
  const measuredFallbackPx = classFontSizes.get("st50") ?? FALLBACK_LABEL_FONT_PX;

  const stations = data.stations;
  const stationIds = Object.keys(stations);

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

  // FULL (abbreviated) name for every dataset station — kept as data-full-name
  // for a future tooltip; the visible label text is NOT rewritten (see below).
  const ABBREVIATIONS = [
    [/\bStation\b/g, "Stn."],
    [/\bUniversity\b/g, "Univ."],
  ];
  function abbreviate(name) {
    let out = name;
    for (const [re, rep] of ABBREVIATIONS) out = out.replace(re, rep);
    return out;
  }
  const fullNameById = new Map();
  for (const id of stationIds) fullNameById.set(id, abbreviate(stations[id].name));

  // -------------------------------------------------------------------------
  // Build the normalized-English-name -> station id(s) lookup, in two tiers:
  //   tier 1 (primary): the full dataset name, the base name before a
  //     trailing "(...)" disambiguator (if any), and any manual
  //     EXTRA_DATASET_NAME_ALIASES.
  //   tier 2 (secondary, paren-inner): the *inner* text of a trailing
  //     "(...)" disambiguator, e.g. "Isu" from "Chongshin Univ. (Isu)".
  // Tier-2 keys are only added to the final lookup when they don't collide
  // with a *different* station's tier-1 key — e.g. "Daeheung (Sogang Univ.)"
  // and "Saejeol (Sinsa)" both have a paren-inner ("Sogang Univ.", "Sinsa")
  // that coincides with a real, independent station's own primary name; the
  // map actually labels those two stations by their base name ("Daeheung",
  // "Saejeol"), so registering the paren-inner key would only ever create a
  // false ambiguity, never resolve a real one — verified against the source.
  // -------------------------------------------------------------------------
  const tier1 = new Map(); // normKey -> Set<id>
  function addTier1(key, id) {
    if (!key) return;
    if (!tier1.has(key)) tier1.set(key, new Set());
    tier1.get(key).add(id);
  }
  const parenInnerCandidates = []; // { key, id }
  for (const id of stationIds) {
    const full = stations[id].name;
    addTier1(normalizeStationNameEn(full), id);
    const m = full.match(TRAILING_PAREN_SUFFIX_RE);
    if (m) {
      addTier1(normalizeStationNameEn(m[1].trim()), id);
      parenInnerCandidates.push({ key: normalizeStationNameEn(m[2].trim()), id });
    }
  }
  for (const [id, aliases] of Object.entries(EXTRA_DATASET_NAME_ALIASES)) {
    for (const alias of aliases) addTier1(normalizeStationNameEn(alias), id);
  }

  const byNormName = new Map();
  for (const [key, set] of tier1) byNormName.set(key, new Set(set));
  for (const { key, id } of parenInnerCandidates) {
    if (!key) continue;
    const owner = tier1.get(key);
    if (owner && !(owner.size === 1 && owner.has(id))) continue; // collides with a different id's primary key — skip
    if (!byNormName.has(key)) byNormName.set(key, new Set());
    byNormName.get(key).add(id);
  }

  // -------------------------------------------------------------------------
  // Collect every station-label <text> on the map. Two shapes exist:
  //  (a) a single line, either as plain text content of <text> (no <tspan>)
  //      or (rarely) a lone <tspan> — both carry class="st49 st50" directly.
  //  (b) a multi-line label: one <text> (no class of its own) wrapping 2+
  //      <tspan class="st49 st50"> children, each holding one visual line
  //      (e.g. "Seoul Nat'l Univ. " + "of Education").
  // Only <text>/<tspan> combinations that carry the st49 label class
  // (directly or via a child tspan) are considered — this excludes legend
  // boxes, the north-arrow/scale note, and line-name captions, all of which
  // use other classes. A distinct `T` class marks title/annotation text
  // rather than a station name — used on exactly 2 spots: the "Not to scale"
  // note, and a "Seongnam" city/region-name label placed near Pangyo/Bundang
  // (a real place ~4700 map-units from the in-scope Incheon
  // "Seongnam(Geobuk Market)" station it shares a name with). Like every
  // other label on this map, "Seongnam" the region name is itself drawn as a
  // 3-copy halo/fill/title duplicate at one shared position, but only ONE of
  // its 3 copies happens to carry the `T` class — so the exclusion has to
  // apply to the whole *position*, not just the individually-`T`-classed
  // element, or the other 2 undecorated copies would still slip through and
  // falsely match the Incheon station.
  // -------------------------------------------------------------------------
  const titleTaintedPositions = new Set();
  $("text").each((_, el) => {
    const $el = $(el);
    if (!($el.attr("class") ?? "").split(/\s+/).includes("T")) return;
    const mtx = parseMatrixTransform($el.attr("transform") ?? "");
    if (mtx) titleTaintedPositions.add(`${mtx.x.toFixed(2)},${mtx.y.toFixed(2)}`);
  });

  const labelInfos = [];
  $("text").each((_, el) => {
    const $el = $(el);
    const tspans = $el.find("tspan");
    const ownClass = $el.attr("class") ?? "";
    const mtxForTaint = parseMatrixTransform($el.attr("transform") ?? "");
    if (mtxForTaint && titleTaintedPositions.has(`${mtxForTaint.x.toFixed(2)},${mtxForTaint.y.toFixed(2)}`)) return;
    const hasSt49 =
      /\bst49\b/.test(ownClass) || tspans.toArray().some((t) => /\bst49\b/.test($(t).attr("class") ?? ""));
    if (!hasSt49) return;

    const lines = tspans.length
      ? tspans.toArray().map((t) => $(t).text())
      : [$el.text()];
    const joinedText = lines.map((l) => l.trim()).join(" ").replace(/\s+/g, " ").trim();
    if (!joinedText) return;

    const mtx = parseMatrixTransform($el.attr("transform") ?? "");
    const classAttr = tspans.length ? ($(tspans[0]).attr("class") ?? ownClass) : ownClass;

    labelInfos.push({
      $el,
      tspanEls: tspans.toArray(),
      text: joinedText,
      lines: lines.map((l) => l.trim()),
      mtx,
      classAttr,
      rotated: mtx ? !isIdentityRotation(mtx) : false,
    });
  });

  // ---- Matching: text -> normalized candidate key(s) -> station id.
  function candidateKeysFor(text) {
    if (KNOWN_OFF_SCOPE_LABEL_TEXT.has(text)) return [];
    const out = [normalizeStationNameEn(text)];
    const m = text.match(TRAILING_PAREN_SUFFIX_RE);
    if (m) out.push(normalizeStationNameEn(m[1].trim()));
    for (const part of splitMiddotName(text)) {
      if (part !== text) out.push(normalizeStationNameEn(part));
    }
    return [...new Set(out)].filter(Boolean);
  }

  const matched = []; // { info, id, key }
  const unmatchedLabels = [];
  const occurrenceIndexByKey = new Map(); // for MANUAL_SVG_MAP occurrence-ordered resolution
  for (const info of labelInfos) {
    let resolvedId = null;
    let usedKey = null;
    for (const key of candidateKeysFor(info.text)) {
      const candidates = byNormName.get(key);
      if (!candidates || candidates.size === 0) continue;
      if (candidates.size === 1) {
        resolvedId = [...candidates][0];
        usedKey = key;
        break;
      }
      const manualList = MANUAL_SVG_MAP[key];
      if (manualList) {
        const idx = occurrenceIndexByKey.get(key) ?? 0;
        occurrenceIndexByKey.set(key, idx + 1);
        resolvedId = manualList[idx] ?? manualList[manualList.length - 1];
        usedKey = key;
        break;
      }
      // ambiguous with no manual resolution — try the next candidate key
      // (e.g. fall through from the full name to the paren-stripped base).
    }
    if (resolvedId) {
      matched.push({ info, id: resolvedId, key: usedKey });
    } else {
      unmatchedLabels.push(info);
    }
  }

  // -------------------------------------------------------------------------
  // Tap-target marker synthesis. Build the combined candidate-marker list:
  //  - 103 환승역 (transfer) <use> icons — center = the use's own
  //    matrix(4 0 0 -4 X Y) translation.
  //  - ~600 single-line-station <line> tick marks — center = segment
  //    midpoint. De-duplicated by exact coordinate: this source SVG renders
  //    a handful of route segments twice (e.g. an outline + fill pass), which
  //    would otherwise register the same physical tick twice.
  // Every matched label is then assigned the nearest not-yet-claimed marker
  // within MAX_MARKER_CLAIM_DIST of its own text anchor (falling back to the
  // nearest marker even if already claimed, then to the label's own anchor
  // coordinate if nothing is within range) — mirrors the previous
  // nearest-circle approach, generalized to two marker shapes instead of one.
  // -------------------------------------------------------------------------
  const tickMarkerByCoord = new Map();
  $("line").each((_, el) => {
    const $el = $(el);
    const x1 = parseFloat($el.attr("x1"));
    const y1 = parseFloat($el.attr("y1"));
    const x2 = parseFloat($el.attr("x2"));
    const y2 = parseFloat($el.attr("y2"));
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;
    const key = `${x1},${y1},${x2},${y2}`;
    if (tickMarkerByCoord.has(key)) return;
    tickMarkerByCoord.set(key, { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r: TICK_MARKER_R, kind: "tick" });
  });
  const transferMarkers = [];
  $('use[xlink\\:href="#환승역"]').each((_, el) => {
    const $el = $(el);
    const m = ($el.attr("transform") ?? "").match(/matrix\(4 0 0 -4 ([-\d.]+) ([-\d.]+)\)/);
    if (!m) return;
    transferMarkers.push({ cx: +m[1], cy: +m[2], r: TRANSFER_MARKER_R, kind: "use" });
  });
  const markers = [...tickMarkerByCoord.values(), ...transferMarkers];

  const claimedMarkers = new Set();
  function claimNearestMarker(ax, ay) {
    let best = null;
    let bestD = Infinity;
    for (const m of markers) {
      if (claimedMarkers.has(m)) continue;
      const d = dist(ax, ay, m.cx, m.cy);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    if (best && bestD <= MAX_MARKER_CLAIM_DIST) return best;
    // Fall back to nearest even if already claimed by another label (dense
    // multi-line-share stations legitimately reuse one physical marker).
    let best2 = null;
    let bestD2 = Infinity;
    for (const m of markers) {
      const d = dist(ax, ay, m.cx, m.cy);
      if (d < bestD2) {
        bestD2 = d;
        best2 = m;
      }
    }
    return best2 && bestD2 <= MAX_MARKER_CLAIM_DIST ? best2 : null;
  }

  // -------------------------------------------------------------------------
  // This map renders 48 station labels THREE times each, at the exact same
  // (x, y) anchor — a stroke-halo pass (class st53, white outline) plus two
  // fill passes — rather than the usual single copy (verified: 684 distinct
  // label positions across 780 label-like <text> elements; every
  // 2+-occurrence position has identical text across all its copies, so this
  // is purely a rendering duplication, not 2-3 distinct nearby stations).
  // Group matched label occurrences by their rounded (x, y) anchor before
  // marker-claiming/horizontalizing: each *physical* label position claims
  // exactly one marker and gets exactly one hit target, regardless of how
  // many duplicate <text> copies render at that spot — otherwise a station's
  // 2nd/3rd duplicate copy would independently "steal" a *different*,
  // nearby station's marker once its own marker is already claimed.
  // -------------------------------------------------------------------------
  const groupsByPosition = new Map(); // "x,y" -> { infos: [...], id }
  for (const { info, id } of matched) {
    if (!stations[id]) continue;
    const key = info.mtx ? `${info.mtx.x.toFixed(2)},${info.mtx.y.toFixed(2)}` : `${id}:${groupsByPosition.size}`;
    if (!groupsByPosition.has(key)) groupsByPosition.set(key, { infos: [], id });
    groupsByPosition.get(key).infos.push(info);
  }

  // ---- Apply tagging + hit targets (once per physical label position).
  const wiredIds = new Set();
  const hitTargetsEl = $("<g>").attr("id", "hit-targets");
  let placedViaMarker = 0;
  let placedViaAnchorFallback = 0;

  for (const { infos, id } of groupsByPosition.values()) {
    const station = stations[id];
    wiredIds.add(id);

    const major = isMajor(id);
    const labelClass = major ? "lbl-major" : "lbl-minor";
    const representative = infos[0];

    const resolvedPx = resolveLabelFontPx(representative.classAttr, classFontSizes, measuredFallbackPx);
    let sizedPx = resolvedPx * LABEL_SIZE_SCALE;
    if (major) sizedPx *= LABEL_MAJOR_SCALE;
    const longestLine = Math.max(...representative.lines.map((l) => l.length));
    if (longestLine > MAX_LABEL_CHARS_BEFORE_SHRINK) sizedPx *= SHRINK_FACTOR;
    const finalPx = Math.round(sizedPx * 100) / 100;
    const styleDecls = [`--lbl-fs:${finalPx}px`, `fill:${LABEL_FILL_COLOR}`];
    if (major) styleDecls.push("font-weight:700");

    // Tap target: nearest transfer-icon/tick marker to this (shared) anchor,
    // falling back to the anchor itself. Computed once per physical group.
    let hx = null;
    let hy = null;
    let marker = null;
    if (representative.mtx) {
      marker = claimNearestMarker(representative.mtx.x, representative.mtx.y);
      if (marker) {
        claimedMarkers.add(marker);
        hx = marker.cx;
        hy = marker.cy;
        placedViaMarker++;
      } else {
        hx = representative.mtx.x;
        hy = representative.mtx.y;
        placedViaAnchorFallback++;
      }
    }
    if (hx != null && hy != null) {
      const hit = $("<circle>")
        .attr("data-station", id)
        .attr("cx", Math.round(hx * 100) / 100)
        .attr("cy", Math.round(hy * 100) / 100)
        .attr("r", 45)
        .attr("fill", "transparent")
        .attr("style", "pointer-events:all");
      hitTargetsEl.append(hit);
    }

    // Tag every duplicate <text> copy at this position identically (queried
    // by tests / future tooltip code). Native label text is left exactly as
    // drawn — this map's English is the native source, so W1 tags rather
    // than replaces (see build report).
    for (const info of infos) {
      info.$el.attr("data-label-for", id);
      info.$el.attr("data-full-name", fullNameById.get(id));
      const existingTextClass = info.$el.attr("class") ?? "";
      if (!existingTextClass.split(/\s+/).includes(labelClass)) {
        info.$el.attr("class", `${existingTextClass} ${labelClass}`.trim());
      }
      const existingStyle = info.$el.attr("style") ?? "";
      info.$el.attr("style", `${existingStyle}${existingStyle ? ";" : ""}${styleDecls.join(";")}`.trim());

      // The --lbl-fs custom property set above inherits down to <tspan>
      // children fine, but font-SIZE itself doesn't: each <tspan> on this
      // map carries its own class="st49 st50" with a *direct*
      // `.st50{font-size:...}` rule, which (being specified directly on the
      // tspan) always wins over whatever the parent <text> computes —
      // inheritance only applies when no rule targets the element itself.
      // app/globals.css's zoom-tier rule (`.subwaywrap .lbl-major`/
      // `.lbl-minor`) only out-specificities `.st50` if `lbl-major`/
      // `lbl-minor` is a class of the SAME element being measured — so for
      // multi-tspan labels the class must also land on each tspan, not just
      // the parent <text> (single-line, no-tspan labels are already fine:
      // the class/style live on the one element that renders).
      for (const tspanEl of info.tspanEls) {
        const $tspan = $(tspanEl);
        const existingTspanClass = $tspan.attr("class") ?? "";
        if (!existingTspanClass.split(/\s+/).includes(labelClass)) {
          $tspan.attr("class", `${existingTspanClass} ${labelClass}`.trim());
        }
      }

      info.major = major;
      info.finalPx = finalPx;
      info.hx = hx;
      info.hy = hy;
      info.marker = marker;
    }
  }
  $("svg").append(hitTargetsEl);

  // ---- Horizontalize rotated labels where it doesn't collide. Nearly every
  // label on this map (736/780) is rotated -45°; straighten each matched one
  // to horizontal wherever a collision-free spot exists near its own marker,
  // same greedy approach as the previous base map (majors first, then by
  // station id, for deterministic/idempotent output).
  const HORIZ_CLEARANCE_PAD = 8; // gap (map units) between marker edge and label edge
  const HORIZ_BOX_PAD = 3; // small buffer so accepted placements aren't flush against a neighbor
  const FALLBACK_MARKER_R = TICK_MARKER_R;
  const CHAR_WIDTH_FACTOR = 0.6;
  const LINE_HEIGHT_FACTOR = 1.2;

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

  function rotatedConservativeBox(ax, ay, width, height, mtx) {
    // Conservative AABB for a still-rotated, start-anchored label: transform
    // its local (0,0)-(width,-height) rect (same 0.8/0.2 baseline split as
    // estimateBox) by the label's own matrix and take the min/max extent.
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
      const gx = ax + lx * mtx.a + ly * mtx.c;
      const gy = ay + lx * mtx.b + ly * mtx.d;
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

  const dotObstacles = markers.map((m) => ({
    left: m.cx - m.r - 0.5,
    right: m.cx + m.r + 0.5,
    top: m.cy - m.r - 0.5,
    bottom: m.cy + m.r + 0.5,
    marker: m,
  }));

  // One item per *physical* label position (see groupsByPosition above) —
  // duplicate-rendered copies at the same spot move together as a unit, both
  // for collision-box purposes (they're one visual label, not three
  // independently-collidable ones) and when a horizontal placement is
  // chosen (every copy's transform is updated identically, so the stroke
  // halo stays aligned with its fill pass).
  const horizItems = [...groupsByPosition.entries()]
    .filter(([, g]) => g.infos[0].hx != null && g.infos[0].hy != null && g.infos[0].mtx != null)
    .map(([, g]) => {
      const rep = g.infos[0];
      const longestLine = Math.max(...rep.lines.map((l) => l.length));
      const width = longestLine * rep.finalPx * CHAR_WIDTH_FACTOR;
      const height = rep.finalPx * LINE_HEIGHT_FACTOR * rep.lines.length;
      const box = rep.rotated
        ? rotatedConservativeBox(rep.mtx.x, rep.mtx.y, width, height, rep.mtx)
        : estimateBox(rep.mtx.x, rep.mtx.y, width, height, "start");
      return { group: g, rep, rotated: rep.rotated, width, height, box, ownMarker: rep.marker ?? null };
    });

  const alreadyHorizontalCount = horizItems.filter((it) => !it.rotated).length;
  let horizontalizedCount = 0;
  const leftRotatedIds = [];

  const order = horizItems
    .map((_, i) => i)
    .sort((ia, ib) => {
      const a = horizItems[ia].group;
      const b = horizItems[ib].group;
      const majorA = a.infos[0].major ? 0 : 1;
      const majorB = b.infos[0].major ? 0 : 1;
      if (majorA !== majorB) return majorA - majorB;
      if (a.id !== b.id) return a.id < b.id ? -1 : 1;
      return 0;
    });

  for (const idx of order) {
    const item = horizItems[idx];
    if (!item.rotated) continue;
    const { group, rep, width, height } = item;
    const hx = rep.hx;
    const hy = rep.hy;
    const r = item.ownMarker ? item.ownMarker.r : FALLBACK_MARKER_R;
    const clearance = r + HORIZ_CLEARANCE_PAD;

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
          if (item.ownMarker && dot.marker === item.ownMarker) continue;
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
      for (const info of group.infos) {
        info.$el.attr("transform", `matrix(1 0 0 1 ${roundedX} ${roundedY})`);
        if (chosen.anchor === "start") {
          info.$el.removeAttr("text-anchor");
        } else {
          info.$el.attr("text-anchor", chosen.anchor);
        }
      }
      item.box = chosen.box;
      item.rotated = false;
      horizontalizedCount++;
    } else {
      leftRotatedIds.push(group.id);
    }
  }

  // ---- Per-station number-code text: expected no-op on this map (see
  // STATION_CODE_RE comment above) — run it anyway, defensively, and report
  // the count so a future re-render regresses loudly instead of silently.
  let removedCodeCount = 0;
  $("text").each((_, el) => {
    const $el = $(el);
    const tspans = $el.find("tspan");
    const content = tspans.length
      ? tspans.toArray().map((t) => $(t).text()).join("").trim()
      : $el.text().trim();
    if (!content || /[가-힣]/.test(content) || !STATION_CODE_RE.test(content)) return;
    $el.remove();
    removedCodeCount++;
  });

  // ---- SVG_SKIP: dataset stations legitimately absent from this map.
  const unwired = stationIds.filter((id) => !wiredIds.has(id) && !SVG_SKIP.has(id));
  const skipButPresent = stationIds.filter((id) => SVG_SKIP.has(id) && wiredIds.has(id));

  const BEAUTY_ZONE_STATIONS = [
    "gangnam",
    "nonhyeon",
    "sinsa",
    "apgujeong",
    "apgujeong_rodeo",
    "cheongdam",
    "gangnamgu_office",
    "hongik_univ",
    "myeongdong",
    "seongsu",
    "yeoksam",
    "seolleung",
  ];
  const beautyZoneUnwired = BEAUTY_ZONE_STATIONS.filter((id) => !wiredIds.has(id));

  // ---- Header comment (PD-self attribution + provenance).
  const header = `<!--
  Seoul metropolitan subway map — processed for essenly.

  Base map: "Seoul_subway_linemap_en.svg" (Wikimedia Commons file IRTC1015),
  ${SOURCE_PAGE_URL}
  Released by its author under PD-self (public domain) — no attribution or
  share-alike is legally required, but it's credited here for provenance.
  This is an independently authored redraw of Seoul's subway network, not an
  official KRIC/Seoul Metro/Kakao map product.

  Processing: scripts/build-subway-svg.mjs — every station <text> label
  matched to lib/subway-data.json by its (already-English) name and tagged
  with data-label-for (station id) and data-full-name (KRIC full name, for a
  future tooltip); visible label text is NOT rewritten, since this map's
  English is native (unlike the previous Korean-labeled base map). Labels
  carry class="lbl-major" (transfer/terminus) or "lbl-minor" plus an inline
  --lbl-fs custom property (near-tier size, read by .lbl-major/.lbl-minor in
  app/globals.css) and a near-black fill, majors additionally bold. A
  transparent per-station hit target (attribute data-station, value =
  station id, r=45) is injected at each matched station's synthesized marker
  location — the nearest 환승역 <use> transfer-icon center or single-line
  <line> tick-mark midpoint to that label's own anchor. Rotated labels
  (nearly all of them — this map draws station names at a uniform -45°) are
  straightened to horizontal wherever a collision-free spot exists near their
  marker.

  Source of the base SVG: ${SOURCE_URL}
-->
`;

  let output = $.xml();
  if (!/^<\?xml/.test(output)) {
    output = `<?xml version="1.0" encoding="UTF-8"?>\n${output}`;
  }
  output = output.replace(/(<\?xml[^>]*\?>\s*)/, `$1${header}`);

  // cheerio's xmlMode serializer numeric-escapes all non-ASCII (Korean legend
  // text, the 환승역 symbol id, etc.), which is valid XML but bloats diffs.
  // Decode plain numeric character references back to literal UTF-8.
  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  output = output.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

  mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  writeFileSync(OUT_SVG, output, "utf8");

  const tsContent = `/* eslint-disable */
// GENERATED FILE — do not edit by hand.
// Produced by scripts/build-subway-svg.mjs from scripts/.cache/seoul-linemap-en.svg
// (Wikimedia Commons, file IRTC1015, PD-self).
// Regenerate with: npm run build:subway-svg

export const METRO_SVG: string = ${JSON.stringify(output)};
`;
  writeFileSync(OUT_TS, tsContent, "utf8");

  // ---- Matching report.
  const totalDatasetStations = stationIds.length;
  const wiredCount = wiredIds.size;
  const wiredRatio = wiredCount / (totalDatasetStations - SVG_SKIP.size);

  console.log("=== Subway SVG build report (Wikimedia base) ===");
  console.log(`Total station-label <text> elements scanned: ${labelInfos.length}`);
  console.log(`Dataset stations: ${totalDatasetStations}`);
  console.log(`Matched label occurrences: ${matched.length}`);
  console.log(`Wired stations (data-station present): ${wiredCount} / ${totalDatasetStations}`);
  console.log(`SVG_SKIP (explicit, excluded from gate): ${SVG_SKIP.size}`);
  if (skipButPresent.length) {
    console.log(`  NOTE: ${skipButPresent.length} SVG_SKIP entries were actually matched anyway: ${skipButPresent.join(", ")}`);
  }
  console.log(`Unwired dataset stations (excl. SVG_SKIP): ${unwired.length}`);
  if (unwired.length) {
    console.log(`  ${unwired.join(", ")}`);
  }
  console.log(`Unmatched map labels (English text with no dataset match — legend/line-name captions or real stations outside this app's 20-line dataset scope): ${unmatchedLabels.length}`);
  console.log(`Wired ratio (excl. SVG_SKIP): ${(wiredRatio * 100).toFixed(2)}%`);

  console.log(`\nBeauty-zone core (12 stations): ${BEAUTY_ZONE_STATIONS.length - beautyZoneUnwired.length} / ${BEAUTY_ZONE_STATIONS.length} wired`);
  if (beautyZoneUnwired.length) {
    console.log(`  MISSING: ${beautyZoneUnwired.join(", ")}`);
  }

  console.log(`\nTap-target marker synthesis — placed via transfer-icon/tick marker: ${placedViaMarker}, via label-anchor fallback: ${placedViaAnchorFallback}`);
  console.log(`Station-number-code text removed (expected no-op on this map): ${removedCodeCount}`);

  console.log(`\nLabel horizontalization:`);
  console.log(`  already horizontal: ${alreadyHorizontalCount}`);
  console.log(`  horizontalized this run: ${horizontalizedCount}`);
  console.log(`  left rotated (no collision-free placement found): ${leftRotatedIds.length}`);

  if (beautyZoneUnwired.length > 0) {
    console.error(`[build-subway-svg] BLOCKED: beauty-zone station(s) not wired: ${beautyZoneUnwired.join(", ")}`);
    process.exit(1);
  }
  if (wiredRatio < 0.95) {
    console.error(`[build-subway-svg] FAILED: wired ratio ${(wiredRatio * 100).toFixed(2)}% < 95% threshold.`);
    process.exit(1);
  }

  console.log("[build-subway-svg] done.");
}

main();
