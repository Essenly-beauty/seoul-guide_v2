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

/**
 * Normalize an English station-name string for cross-source matching between
 * lib/subway-data.json's KRIC-derived `name` field and the Wikimedia base
 * map's native English `<text>` labels. Both sides spell most multi-word
 * campus/transit terms out fully in some places and abbreviate them in
 * others (e.g. "University" vs "Univ." vs "Univ", "International" vs
 * "Int'l"), and differ on incidental punctuation (hyphens, periods,
 * apostrophes — straight or curly, mid-name parentheticals like
 * "Jongno 3(sam)ga"). Canonicalize the well-known KRIC abbreviation pairs to
 * a shared short token *before* stripping punctuation, then strip everything
 * but letters/digits and lowercase — so e.g. "Seoul Nat'l Univ." and
 * "Seoul National University" both reduce to "seoulnatluniv", and
 * "Jongno 3(sam)-ga" / "Jongno 3(sam)ga" both reduce to "jongno3samga".
 * Apostrophe style (straight vs the curly U+2018/U+2019 that shows up in a
 * couple of dataset names) needs no special-casing: it's stripped either way
 * by the final punctuation pass.
 */
export function normalizeStationNameEn(name) {
  if (!name) return "";
  let s = name;
  s = s.replace(/\bStation\b/gi, "Stn");
  s = s.replace(/\bStn\.?\b/gi, "Stn");
  s = s.replace(/\bUniversity\b/gi, "Univ");
  s = s.replace(/\bUniv\.?\b/gi, "Univ");
  s = s.replace(/\bInternational\b/gi, "Intl");
  s = s.replace(/\bInt'l\b/gi, "Intl");
  s = s.replace(/\bNational\b/gi, "Natl");
  s = s.replace(/\bNat'l\b/gi, "Natl");
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Trailing "(...)" disambiguator/former-name suffix, e.g.
 * "Chongshin Univ. (Isu)" -> base "Chongshin Univ.", inner "Isu"; or
 * "Yangjae (Seocho-gu Office)" -> base "Yangjae", inner "Seocho-gu Office".
 * NOT a mid-string paren like "Jongno 3(sam)ga" (the `$` anchor requires the
 * parenthetical to be the last thing in the string).
 */
export const TRAILING_PAREN_SUFFIX_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;

/**
 * Split a middot(·)-combined label into its parts, trimmed — e.g. the
 * Wikimedia base map occasionally joins two place names into one label with
 * a middot (e.g. "Jeondae·Everland"). Returns `[name]` unchanged (as a
 * single-element array) when there's no middot, so callers can always
 * iterate the result uniformly.
 */
export function splitMiddotName(name) {
  if (!name || !name.includes("·")) return [name];
  return name.split("·").map((part) => part.trim()).filter(Boolean);
}
