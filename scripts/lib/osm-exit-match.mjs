// Shared OSM `railway=subway_entrance` matching helpers.
//
// Extracted verbatim from scripts/build-station-exits.mjs so the exit builder
// and the coordinate audit (scripts/audit-station-coords.mjs) agree on how an
// entrance is bound to a station — an audit that matched entrances differently
// from the builder would be auditing its own opinion, not our data.
//
// Data © OpenStreetMap contributors, ODbL.

export const metres = (a, b) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1000;
};

/** "3" → 3, "3-1" → 3 (sub-exits collapse onto their parent number). */
export function exitNumber(ref) {
  const m = String(ref).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Fold spelling variants so "Nat'l Univ" and "National University" agree. */
export const normalizeEn = (s) =>
  s
    .toLowerCase()
    .replace(/nat['’]?l\b/g, "national")
    .replace(/\bsh/g, "s") // Shinnonhyeon ≡ Sinnonhyeon
    .replace(/univ\b\.?/g, "university")
    .replace(/[^a-z0-9]/g, "");
export const normalizeKo = (s) => s.replace(/\s/g, "").replace(/역$/, "");

/** Candidate keys for one English station name. Seoul renames stations with a
    parenthetical secondary name ("Jamsil (Songpa-gu Office)", "Chongshin Univ.
    (Isu)") while OSM usually carries only one of the two parts — and numbered
    stations differ in romanization ("Euljiro 3(sam)ga" vs "Euljiro 3-ga"). So
    index the full string, the string with parentheses removed, AND the
    parenthetical content on its own. */
export function englishKeys(name) {
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
export function stationNameFrom(tags) {
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

/** Station-name → id index. Ambiguous names (two stations sharing a normalized
    name) are dropped so they fall through to proximity rather than binding to
    an arbitrary winner. */
export function buildNameIndex(stations) {
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
  return { nameIndex, ambiguous };
}

/** lib/subway-data.json → flat [{ id, name, nameKr, lat, lng, … }]. */
export function stationList(raw) {
  const source = raw.stations ?? raw;
  return Array.isArray(source) ? source : Object.entries(source).map(([id, s]) => ({ id, ...s }));
}
