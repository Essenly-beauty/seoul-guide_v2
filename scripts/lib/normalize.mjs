// Shared station-name normalization, reused by build-subway-data.mjs (Task 1)
// and by SVG-label matching (Task 3). Keep this the single source of truth.

/**
 * Normalize a Korean station name for cross-source matching:
 * - strip parenthetical suffixes: "서울대입구(관악구청)" -> "서울대입구"
 * - strip all whitespace
 * - strip a trailing "역" (station) suffix: "김포공항역" -> "김포공항"
 */
export function normalizeStationNameKr(name) {
  if (!name) return "";
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/역$/, "")
    .trim();
}

/**
 * Deterministic slug for a normalized Korean station name, using the
 * anchor romanization table first, then a generic transliteration fallback.
 * Callers append a line-suffix themselves on collision.
 */
const ANCHOR_ROMANIZATION = {
  강남: "gangnam",
  논현: "nonhyeon",
  학동: "hakdong",
  청담: "cheongdam",
  건대입구: "konkuk_univ",
  압구정로데오: "apgujeong_rodeo",
  선릉: "seolleung",
  홍대입구: "hongik_univ",
  명동: "myeongdong",
  강남구청: "gangnamgu_office",
  역삼: "yeoksam",
  신사: "sinsa",
  압구정: "apgujeong",
  고속터미널: "express_bus",
  자양: "jayang",
  시청: "city_hall",
};

/** Slugify an English name (KRIC official romanization) as a deterministic fallback id. */
export function slugifyEnglishName(nameEn) {
  return nameEn
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Base station id: anchor romanization table when available (readable,
 * stable ids for the beauty-zone stations), otherwise a slug of the
 * official English name. Deterministic — same input always yields same id.
 */
export function baseStationId(nameKr, nameEn) {
  const normKr = normalizeStationNameKr(nameKr);
  if (ANCHOR_ROMANIZATION[normKr]) return ANCHOR_ROMANIZATION[normKr];
  return slugifyEnglishName(nameEn);
}

export { ANCHOR_ROMANIZATION };
