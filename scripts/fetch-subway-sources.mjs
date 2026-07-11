#!/usr/bin/env node
// Fetch raw subway data sources into scripts/.cache/ (idempotent — skips files
// that already exist). Run via `npm run build:subway-data`.
//
// Sources:
// 1. KRIC (한국철도공단) 전국도시철도역사정보표준데이터 — data.go.kr dataset
//    15093755 links out to KRIC's own portal (data.kric.go.kr), which serves
//    a keyless XLSX. Discovered path: data.go.kr's public listing page ->
//    "바로가기" link -> https://data.kric.go.kr/rips/M_01_01/detail.do?id=32
//    -> direct file download at /rips/dataset/download.file?type=filedata&id=32&operation=1
// 2. vuski/seoulsubway (MIT, https://github.com/vuski/seoulsubway) —
//    nodeData.js / linkData.js via raw.githubusercontent.com. Coordinates in
//    that file are EPSG:5179 and are NOT used; only line grouping, adjacency,
//    and travel-time (seconds) are taken from it.
// 3. Sinseiki/opensource-seoul-subway-map (MIT,
//    https://github.com/Sinseiki/opensource-seoul-subway-map) — mapimage.svg,
//    a schematic Seoul metropolitan subway map (~1150x1075 viewBox, per-station
//    <circle> markers + Korean <text>/<tspan> labels). This was the base map
//    used by build-subway-svg.mjs prior to the Wikimedia swap below; the
//    download is kept here (harmless, unused by the current build) in case a
//    future task needs to compare against it, but build-subway-svg.mjs no
//    longer reads it.
// 4. Wikimedia Commons — "Seoul_subway_linemap_en.svg" (file IRTC1015,
//    PD-self / public domain, uploaded by the map's own author) —
//    an official-style octilinear Seoul metropolitan subway map
//    (viewBox 0 0 5724 6516, portrait) with native English <text> station
//    labels, <use href="#환승역"> transfer-station markers, and per-station
//    <line> tick marks. This is the current base map for
//    build-subway-svg.mjs (see that file for processing details).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");

const KRIC_DOWNLOAD_URL =
  "https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1";
const VUSKI_NODE_URL =
  "https://raw.githubusercontent.com/vuski/seoulsubway/master/nodeData.js";
const VUSKI_LINK_URL =
  "https://raw.githubusercontent.com/vuski/seoulsubway/master/linkData.js";
const SINSEIKI_MAPIMAGE_URL =
  "https://raw.githubusercontent.com/Sinseiki/opensource-seoul-subway-map/master/mapimage.svg";
const WIKIMEDIA_LINEMAP_EN_URL =
  "https://upload.wikimedia.org/wikipedia/commons/2/2f/Seoul_subway_linemap_en.svg";

const FILES = [
  { name: "kric_stations.xlsx", url: KRIC_DOWNLOAD_URL, required: true },
  { name: "nodeData.js", url: VUSKI_NODE_URL, required: true },
  { name: "linkData.js", url: VUSKI_LINK_URL, required: true },
  // Kept for provenance/comparison; no longer read by build-subway-svg.mjs.
  { name: "mapimage.svg", url: SINSEIKI_MAPIMAGE_URL, required: true },
  // Current base map for build-subway-svg.mjs.
  { name: "seoul-linemap-en.svg", url: WIKIMEDIA_LINEMAP_EN_URL, required: true },
];

async function downloadFile({ name, url, required }) {
  const dest = path.join(CACHE_DIR, name);
  if (existsSync(dest)) {
    console.error(`[fetch] cache hit, skipping: ${name}`);
    return;
  }
  console.error(`[fetch] downloading ${name} from ${url}`);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error("empty response body");
    writeFileSync(dest, buf);
    console.error(`[fetch] saved ${name} (${buf.length} bytes)`);
  } catch (err) {
    if (!required) {
      console.error(`[fetch] optional source failed, continuing: ${name} — ${err.message}`);
      return;
    }
    console.error(`[fetch] FAILED to download required source: ${name}`);
    console.error(`[fetch] error: ${err.message}`);
    console.error("");
    console.error("Manual download instructions:");
    if (name === "kric_stations.xlsx") {
      console.error(
        "  1. Open https://data.kric.go.kr/rips/M_01_01/detail.do?id=32 in a browser"
      );
      console.error('  2. Click the "다운로드" button (XLSX, keyless).');
      console.error(`  3. Save the file as: ${dest}`);
      console.error(
        "  (Fallback origin: https://www.data.go.kr/data/15013205/standard.do -> \"기관자체에서 다운로드\" -> 바로가기 link above.)"
      );
    } else {
      console.error(`  1. Open ${url} in a browser`);
      console.error(`  2. Save the file as: ${dest}`);
    }
    process.exit(1);
  }
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const file of FILES) {
    await downloadFile(file);
  }
  console.error("[fetch] done.");
}

main();
