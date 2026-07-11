#!/usr/bin/env node
// 이 데이터를 사용하실 경우, 코드에 다음의 주석을 반드시 남겨주시기 바랍니다.
// source: https://github.com/vuski/seoulsubway
//
// Build lib/subway-data.json from cached sources (run fetch-subway-sources.mjs
// first). Merge logic:
//
//   vuski/seoulsubway (https://github.com/vuski/seoulsubway, MIT) supplies:
//     - which lines/stations are currently operating (vs. planned/GTX/future
//       extensions, which vuski also carries but which we exclude below)
//     - line grouping (KRIC splits one physical line into several
//       KRIC 노선명 for right-of-way/operator reasons, e.g. Seoul Line 1 =
//       KRIC's 1호선+경부선+경인선+경원선+일산선; vuski already unifies these)
//     - adjacency + travel time in seconds (linkData.js)
//     - line colors (nodeData.js `cl`), used verbatim except where vuski
//       leaves a line uncolored (grey placeholder), noted below
//   KRIC 전국도시철도역사정보표준데이터 (공공누리, data.go.kr / data.kric.go.kr)
//   supplies the authoritative fields our schema needs: 역사명(KR), 영문역사명,
//   위도/경도. vuski's own x/y are EPSG:5179 (not lat/lng) and are unused.
//
// Matching: vuski KR station name <-> KRIC 역사명, both normalized via
// scripts/lib/normalize.mjs (strip parenthetical suffix, whitespace, trailing
// "역"). Name mismatches that are genuinely the same real, operating station
// are resolved via MANUAL_NAME_MAP below. vuski also carries placeholder
// nodes for lines/extensions that are not yet operating, individually
// verified against the KRIC extract and listed in KNOWN_FUTURE_OR_MISSING —
// those are logged to stderr and dropped (KRIC has no coordinates for a
// station that doesn't exist yet), and don't count against the unresolved-
// station fail gate below, which is reserved for *unexpected* mismatches.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { normalizeStationNameKr, baseStationId } from "./lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, ".cache");
const OUT_PATH = path.join(__dirname, "..", "lib", "subway-data.json");

const UNRESOLVED_FAIL_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Line grouping: vuski line name -> { id, label, labelKr, krLineNames }
// krLineNames are the KRIC 노선명 values that make up this physical line.
// GTX-A/B/C and all other planned-only lines are intentionally absent here.
// ---------------------------------------------------------------------------
const LINE_GROUPS = {
  서울1호선: { id: "1", label: "Line 1", labelKr: "1호선", kr: ["1호선", "경부선", "경인선", "경원선", "장항선"], color: null },
  서울2호선: { id: "2", label: "Line 2", labelKr: "2호선", kr: ["2호선"], color: null },
  서울3호선: { id: "3", label: "Line 3", labelKr: "3호선", kr: ["3호선", "일산선"], color: null },
  서울4호선: { id: "4", label: "Line 4", labelKr: "4호선", kr: ["4호선", "안산과천선", "진접선"], color: null },
  서울5호선: { id: "5", label: "Line 5", labelKr: "5호선", kr: ["5호선"], color: null },
  서울6호선: { id: "6", label: "Line 6", labelKr: "6호선", kr: ["6호선"], color: null },
  서울7호선: { id: "7", label: "Line 7", labelKr: "7호선", kr: ["7호선", "도시철도 7호선"], color: null },
  서울8호선: { id: "8", label: "Line 8", labelKr: "8호선", kr: ["8호선", "수도권 광역철도 8호선"], color: null },
  서울9호선: { id: "9", label: "Line 9", labelKr: "9호선", kr: ["서울 도시철도 9호선", "수도권  도시철도 9호선"], color: null },
  서울9호선급행: { id: "9", label: "Line 9", labelKr: "9호선", kr: ["서울 도시철도 9호선", "수도권  도시철도 9호선"], color: null },
  신분당선: { id: "sinbundang", label: "Sinbundang Line", labelKr: "신분당선", kr: ["신분당선"], color: null },
  수인선: { id: "suin_bundang", label: "Suin–Bundang Line", labelKr: "수인분당선", kr: ["수인선", "분당선"], color: null },
  분당선: { id: "suin_bundang", label: "Suin–Bundang Line", labelKr: "수인분당선", kr: ["수인선", "분당선"], color: null },
  경의중앙선: { id: "gyeongui_jungang", label: "Gyeongui–Jungang Line", labelKr: "경의중앙선", kr: ["경의중앙선"], color: null },
  공항철도: { id: "airport", label: "Airport Railroad", labelKr: "공항철도", kr: ["인천국제공항선"], color: null },
  우이신설경전철: { id: "ui_sinseol", label: "Ui-Sinseol Line", labelKr: "우이신설선", kr: ["우이신설선"], color: null },
  신림선: { id: "sillim", label: "Sillim Line", labelKr: "신림선", kr: ["수도권 경량도시철도 신림선"], color: "#6789CA" },
  김포도시철도: { id: "gimpo_gold", label: "Gimpo Gold Line", labelKr: "김포골드라인", kr: ["김포도시철도"], color: null },
  서해선: { id: "seohae", label: "Seohae Line", labelKr: "서해선", kr: ["서해선"], color: null },
  경춘선: { id: "gyeongchun", label: "Gyeongchun Line", labelKr: "경춘선", kr: ["경춘선"], color: null },
  인천1호선: { id: "incheon1", label: "Incheon Line 1", labelKr: "인천1호선", kr: ["인천지하철 1호선"], color: null },
  인천2호선: { id: "incheon2", label: "Incheon Line 2", labelKr: "인천2호선", kr: ["인천지하철 2호선"], color: null },
};

// Real, currently-operating stations whose vuski KR name doesn't match the
// KRIC 역사명 under simple normalization (checked individually against the
// KRIC extract — see .superpowers/sdd/task-s1-report.md for the derivation).
const MANUAL_NAME_MAP = {
  지제: "평택지제",
  별가람: "별내별가람",
  덕풍: "하남시청",
  서울대: "서울대벤처타운",
  이수: "총신대입구", // KRIC's dual-name station (Line 4 + Line 7 transfer)
  풍산: "하남풍산", // Line 5 Misa extension; distinct from Gyeongui-Jungang's 풍산
  // vuski disambiguates its own two same-named "양평" nodes with a line
  // suffix (Seoul Line 5's Yangpyeong in Yeongdeungpo-gu vs. Gyeongui–Jungang
  // Line's Yangpyeong ~50km east in Yangpyeong-gun) — both are real,
  // distinct KRIC stations; map each vuski spelling to its own KRIC row.
  양평_5호선: "양평", // KRIC: 양평/5호선
  양평_경의중앙: "양평역", // KRIC: 양평역/경의중앙선
  뚝섬유원지: "자양", // Line 7's station was renamed; KRIC: 자양(뚝섬한강공원)
};

// Stations vuski carries that this KRIC extract does not (yet) have —
// individually checked against the 2026-06-30 KRIC file. Two categories:
//   (a) not-yet-operating extensions vuski pre-populates (recognizable by
//       being appended at the tail of nodeData.js with anomalously high
//       `no`, e.g. placeholder ids like "연장101"/"추가역1"/"S1역", or real
//       future station names for lines/segments not yet in service — Line 8's
//       further Guri/Byeollae-area extension, the remainder of Line 9's
//       Gangil extension beyond Godeok, Sillim Line's own further extension,
//       Sinbundang's planned Sangam/Suwon extensions, Incheon Line 1's
//       extension, Line 3's Toegyewon extension);
//   (b) real, currently-operating stations this particular KRIC extract is
//       simply missing outright (data gap, not a naming mismatch) — 신길온천,
//       당고개, 학익, 김포시청, 화전, 원곡, 초성리, 국제테마파크역,
//       송도국제도시, 과천지식정보단지.
// Listed here (rather than silently swallowed) so the unresolved-station
// gate below stays meaningful for *unexpected* mismatches.
const KNOWN_FUTURE_OR_MISSING = new Set([
  "서해선:원곡",
  "경의중앙선:화전",
  "김포도시철도:김포시청",
  "서울4호선:신길온천",
  "서울4호선:당고개",
  "서울8호선:우남",
  "수인선:신길온천",
  "수인선:학익",
  "서해선:국제테마파크역",
  "인천1호선:송도국제도시",
  "서울4호선:과천지식정보단지",
  "서울5호선:창우",
  "서울7호선:고읍",
  "서울8호선:선사",
  "서울8호선:토평",
  "서울8호선:구리도매시장",
  "서울8호선:진건",
  "서울1호선:초성리",
  "신림선:동작구민회관",
  "신림선:서림",
  "신림선:여의도성모병원",
  "서울7호선:국제업무단지",
  "서울7호선:청라시티타워",
  "서울7호선:커낼웨이",
  "서울7호선:가현",
  "서울7호선:독골사거리",
  "우이신설경전철:우이102",
  "우이신설경전철:우이103",
  "인천1호선:인천1연장101",
  "인천1호선:인천1연장102",
  "인천1호선:인천1연장103",
  "서울3호선:추가역1",
  "서울3호선:추가역2",
  "서울3호선:추가역3",
  "서울3호선:S1역",
  "서울3호선:S2역",
  "서울3호선:S3역",
  "서울5호선:연장101",
  "서울5호선:연장102",
  "서울5호선:연장103",
  "서울5호선:인천1연장102",
  "서울5호선:연장106",
  "서울5호선:연장108",
  "서울7호선:옥정",
  "서울9호선:생태공원사거리",
  "서울9호선:한영고교",
  "서울9호선:샘터공원",
  "서울9호선:강일고교",
  "서울9호선급행:강일고교",
  "신분당선:진관",
  "신분당선:은평",
  "신분당선:상명대",
  "신분당선:국립박물관",
  "신분당선:동빙고",
  "신분당선:수원월드컵경기장",
  "신분당선:동수원",
  "신분당선:구운",
  "신분당선:호매실",
]);

// vuski also lists Sinbundang Line's approved-but-not-yet-built Sangam
// (northern) and Suwon (southern) extensions using real station names that
// already exist today under a *different* line (e.g. "시청" already exists
// on Lines 1/2; the future Sinbundang platform there doesn't open service
// until the extension is built). Matching succeeds for these (the station
// itself is real), but Sinbundang must not be added to that station's line
// list yet — tracked here by vuski `no`, all in the Sinbundang extension's
// tail block (see .superpowers/sdd/task-s1-report.md for the derivation).
const SINBUNDANG_FUTURE_EXTENSION_NOS = new Set([
  1033, 1034, 1035, 1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043, 1044, 1045, 1046, 1047,
]);

// KRIC row-level coordinate fixes: 양원역(Yangwon, Gyeongui–Jungang line,
// station code I4108/1204) is recorded by KRIC at lat 36.9637/lng 129.0913
// (Yeongdeok, Gyeongsangbuk-do — ~200km from Seoul), which is inconsistent
// with its own address field ("서울시 중랑구 송림길 147") and its station code
// sitting numerically between 망우역(1203) and 구리역(1205), both real
// Jungnang-gu/Guri stations. Corrected to Yangwon's public real-world
// location (interpolated between its immediate neighbors on the line).
const COORDINATE_CORRECTIONS = {
  양원: { lat: 37.6035, lng: 127.1084 },
};

const DEFAULT_EDGE_SECONDS = 120;

function loadKric() {
  const wb = XLSX.readFile(path.join(CACHE_DIR, "kric_stations.xlsx"));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const [, ...data] = rows;
  // KRIC columns (see README "Data sources"): 역번호,역사명,노선번호,노선명,
  // 영문역사명,한자역사명,환승역구분,환승노선번호,환승노선명,역위도,역경도, ...
  return data.map((r) => ({
    nameKr: r[1],
    lineName: r[3],
    nameEn: r[4],
    // A handful of KRIC rows store lat/lng as text-formatted xlsx cells
    // instead of numeric cells (e.g. 구리/Line 8 extension) — coerce so the
    // schema's number contract holds regardless of source cell formatting.
    lat: Number(r[9]),
    lng: Number(r[10]),
  }));
}

function loadVuskiNodes() {
  const txt = readFileSync(path.join(CACHE_DIR, "nodeData.js"), "utf8");
  const jsonPart = txt.split("var nodeDataRaw = ")[1].split(";")[0].trim();
  return JSON.parse(jsonPart);
}

function loadVuskiLinks() {
  const txt = readFileSync(path.join(CACHE_DIR, "linkData.js"), "utf8");
  const jsonPart = txt.split("var linkDataRaw =")[1].split(";")[0].trim();
  return JSON.parse(jsonPart);
}

function main() {
  const kric = loadKric();
  const vuskiNodes = loadVuskiNodes();
  const vuskiLinks = loadVuskiLinks();

  // Index KRIC rows by normalized name -> list of rows (one per line it serves).
  // KRIC's file is nationwide (Busan/Daegu/Daejeon/Gwangju systems included);
  // restrict to the Seoul metropolitan area's bounding box up front so a
  // same-named station in another city can never be picked up as a false
  // match (e.g. Daegu's "용산(서부법원·검찰청입구)" vs. Seoul's "용산역").
  const SEOUL_METRO_BBOX = { latMin: 36.5, latMax: 38.3, lngMin: 126.3, lngMax: 127.9 };
  const kricByName = new Map();
  for (const row of kric) {
    const correction = COORDINATE_CORRECTIONS[normalizeStationNameKr(row.nameKr)];
    if (correction) Object.assign(row, correction);
    if (
      row.lat <= SEOUL_METRO_BBOX.latMin ||
      row.lat >= SEOUL_METRO_BBOX.latMax ||
      row.lng <= SEOUL_METRO_BBOX.lngMin ||
      row.lng >= SEOUL_METRO_BBOX.lngMax
    ) {
      continue;
    }
    const key = normalizeStationNameKr(row.nameKr);
    if (!kricByName.has(key)) kricByName.set(key, []);
    kricByName.get(key).push(row);
  }

  const lines = {};
  const stationsByVuskiNo = new Map(); // vuski no -> resolved stationId (or null if dropped)
  const stations = {};
  const knownDrops = [];
  const unexpectedUnmatched = [];

  for (const node of vuskiNodes) {
    const group = LINE_GROUPS[node.ln];
    if (!group) continue; // GTX / planned / out-of-scope line — skip entirely
    if (node.ln === "신분당선" && SINBUNDANG_FUTURE_EXTENSION_NOS.has(node.no)) {
      knownDrops.push(`${node.ln}:${node.nm} (no=${node.no}, future extension)`);
      stationsByVuskiNo.set(node.no, null);
      continue;
    }

    if (!lines[group.id]) {
      lines[group.id] = { label: group.label, labelKr: group.labelKr, color: group.color ?? node.cl };
    }

    let key = normalizeStationNameKr(node.nm);
    if (MANUAL_NAME_MAP[key]) key = normalizeStationNameKr(MANUAL_NAME_MAP[key]);

    const candidates = kricByName.get(key) ?? [];
    // Prefer a KRIC row explicitly filed under this line group's KRIC line
    // name(s); KRIC sometimes files a transfer station's row under only one
    // of its lines (e.g. 까치산 is filed under "5호선" only, though it is
    // also a real Line 2 stop) — in that case fall back to any KRIC row for
    // the same normalized name (lat/lng/nameEn for the same physical station
    // don't meaningfully vary by which line "owns" the KRIC row).
    const kricRow = candidates.find((r) => group.kr.includes(r.lineName)) ?? candidates[0];
    if (!kricRow) {
      const label = `${node.ln}:${node.nm} (no=${node.no})`;
      const bareLabel = `${node.ln}:${node.nm}`;
      if (KNOWN_FUTURE_OR_MISSING.has(bareLabel)) {
        knownDrops.push(label);
      } else {
        unexpectedUnmatched.push(label);
      }
      stationsByVuskiNo.set(node.no, null);
      continue;
    }

    // stationId: base slug from normalized KR name / English romanization,
    // suffixed by line id if the base id is already taken by a *different*
    // physical station (KRIC lat/lng far apart under the same normalized
    // name — e.g. Yangpyeong on Line 5 vs. Yangpyeong on Gyeongui-Jungang).
    // The anchor row for slug purposes is picked once from the full
    // candidate list, sorted deterministically (shortest nameEn first, then
    // alphabetically) so every vuski occurrence of the same real station
    // agrees on one id — a per-row "shortest form" heuristic is more robust
    // than trying to detect "extra annotation" parens, since some official
    // romanizations legitimately contain parens as part of the name itself
    // (e.g. "Jongno 3(sam)ga").
    const anchorRow = [...candidates].sort((a, b) => a.nameEn.length - b.nameEn.length || a.nameEn.localeCompare(b.nameEn))[0] ?? kricRow;
    // Use the resolved `key` (post-MANUAL_NAME_MAP), not the raw vuski name,
    // so a renamed/relabeled station (e.g. vuski's old "뚝섬유원지" for what
    // KRIC now calls "자양") still hits the anchor romanization table under
    // its current name.
    let stationId = baseStationId(key, anchorRow.nameEn);
    const existing = stations[stationId];
    if (existing) {
      const distinctPlace =
        Math.abs(existing.lat - kricRow.lat) > 0.01 || Math.abs(existing.lng - kricRow.lng) > 0.01;
      if (distinctPlace) {
        stationId = `${stationId}_${group.id}`;
      }
    }

    if (!stations[stationId]) {
      stations[stationId] = {
        name: kricRow.nameEn,
        nameKr: normalizeStationNameKr(kricRow.nameKr),
        lat: kricRow.lat,
        lng: kricRow.lng,
        lines: [],
        transfer: false,
      };
    }
    if (!stations[stationId].lines.includes(group.id)) {
      stations[stationId].lines.push(group.id);
    }
    stations[stationId].transfer = stations[stationId].lines.length > 1;
    stationsByVuskiNo.set(node.no, stationId);
  }

  if (knownDrops.length > 0) {
    console.error(
      `[build] ${knownDrops.length} vuski station(s) dropped — known future/not-yet-built extensions or confirmed gaps in this KRIC extract (see KNOWN_FUTURE_OR_MISSING):`
    );
    for (const d of knownDrops) console.error(`  - ${d}`);
  }

  if (unexpectedUnmatched.length > 0) {
    console.error(
      `[build] ${unexpectedUnmatched.length} vuski station(s) had NO KRIC match and are NOT in KNOWN_FUTURE_OR_MISSING (matching failure — add to MANUAL_NAME_MAP or investigate):`
    );
    for (const u of unexpectedUnmatched) console.error(`  - ${u}`);
  }

  // Per the task brief: unresolved (non-manually-mapped, non-placeholder)
  // name mismatches beyond this threshold fail the build so a partial
  // dataset is never shipped silently.
  if (unexpectedUnmatched.length > UNRESOLVED_FAIL_THRESHOLD) {
    console.error(
      `[build] FAILED: ${unexpectedUnmatched.length} unresolved stations exceeds the fail threshold of ${UNRESOLVED_FAIL_THRESHOLD}.`
    );
    process.exit(1);
  }

  // Edges: undirected, one record per pair (from<to alpha-sorted), seconds
  // from vuski if present, else DEFAULT_EDGE_SECONDS. Endpoints resolved via
  // stationsByVuskiNo; edges touching a dropped node are skipped. The line id
  // for an edge is the line the two endpoint stations share (first common).
  const edgeSet = new Map(); // key "a|b|line" -> seconds
  for (const [fromNo, toNo, seconds] of vuskiLinks) {
    const fromId = stationsByVuskiNo.get(fromNo);
    const toId = stationsByVuskiNo.get(toNo);
    if (!fromId || !toId || fromId === toId) continue;
    const fromStation = stations[fromId];
    const toStation = stations[toId];
    const commonLine = fromStation.lines.find((l) => toStation.lines.includes(l));
    if (!commonLine) continue;
    const [a, b] = [fromId, toId].sort();
    const key = `${a}|${b}|${commonLine}`;
    const secs = seconds && seconds > 0 ? seconds : DEFAULT_EDGE_SECONDS;
    if (!edgeSet.has(key) || edgeSet.get(key) > secs) {
      edgeSet.set(key, secs);
    }
  }

  const edges = [...edgeSet.entries()].map(([key, seconds]) => {
    const [a, b, line] = key.split("|");
    return [a, b, line, seconds];
  });

  const output = { lines, stations, edges };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(output));

  console.error(
    `[build] wrote ${OUT_PATH}: ${Object.keys(stations).length} stations, ${edges.length} edges, ${Object.keys(lines).length} lines`
  );
}

main();
