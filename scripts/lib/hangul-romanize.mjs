// Revised-Romanization transliteration plus the name-similarity score the
// second Korean-name pass (scripts/backfill-kr-names-2.mjs) uses as its
// supporting signal.
//
// Why this exists: the first pass (scripts/backfill-kr-names.mjs) accepted a
// Kakao candidate on distance + category alone, which is safe at ≤30 m and
// tolerable at ≤100 m — but 137 salons were left unmatched because their real
// storefront sits a little further from the geocoded address point than that.
// Widening the radius without a second, independent signal would start
// attaching the neighbouring shop's name to a place, and a wrong Korean name
// handed to a taxi driver is worse than an English one. Romanizing the Kakao
// name and comparing it to our English name is that second signal: Korean
// salon names are overwhelmingly transliterations of the same brand
// ("차홍아르더" ↔ "Chahong Ardor", "준오헤어" ↔ "Juno Hair").

const INITIALS = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const MEDIALS = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const FINALS = ["","k","k","k","n","n","n","t","l","k","m","l","l","l","p","l","m","p","p","t","t","ng","t","t","k","t","p","t"];

/** Revised Romanization, character-by-character (no inter-syllable sandhi —
    good enough for fuzzy matching and stable/deterministic). */
export function romanize(text) {
  let out = "";
  for (const ch of String(text ?? "")) {
    const code = ch.codePointAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const s = code - 0xac00;
      out += INITIALS[Math.floor(s / 588)] + MEDIALS[Math.floor((s % 588) / 28)] + FINALS[s % 28];
    } else {
      out += ch;
    }
  }
  return out;
}

// Loanwords that appear in half the salon names on both sides of the match.
// Romanization turns 헤어 into "heeo", which shares almost nothing with
// "hair"; folding both sides to the same token first is what makes the
// bigram score meaningful for these.
const LOANWORDS = [
  ["헤어", "hair"], ["살롱", "salon"], ["살론", "salon"], ["샬롱", "salon"],
  ["뷰티", "beauty"], ["스튜디오", "studio"], ["아뜰리에", "atelier"], ["아틀리에", "atelier"],
  ["하우스", "house"], ["바버", "barber"], ["바버샵", "barbershop"], ["컬러", "color"],
  ["네일", "nail"], ["스파", "spa"], ["케어", "care"], ["스타일", "style"],
  ["클럽", "club"], ["갤러리", "gallery"], ["스토리", "story"], ["플러스", "plus"],
  ["뷰", "view"], ["샵", "shop"], ["숍", "shop"], ["앤", "and"], ["더", "the"],
  ["뮤즈", "muse"], ["코드", "code"], ["랩", "lab"], ["룸", "room"], ["로우", "raw"],
  ["퍼스널컬러", "personalcolor"], ["메이크업", "makeup"], ["에스테틱", "aesthetic"],
  ["클리닉", "clinic"], ["피부과", "dermatology"], ["의원", "clinic"],
  ["헤어드레싱", "hairdressing"], ["드레싱", "dressing"], ["플래그십", "flagship"],
  // Neighbourhoods. Both sides name the same district, so leaving them in
  // makes every salon in Hongdae look like every other salon in Hongdae.
  ["홍대", "hongdae"], ["성수", "seongsu"], ["강남", "gangnam"], ["명동", "myeongdong"],
  ["압구정", "apgujeong"], ["청담", "cheongdam"], ["신사", "sinsa"], ["잠실", "jamsil"],
  ["이태원", "itaewon"], ["여의도", "yeouido"], ["한남", "hannam"], ["신촌", "sinchon"],
  ["종로", "jongno"], ["부산", "busan"], ["이대", "edae"], ["합정", "hapjeong"],
  ["역삼", "yeoksam"], ["논현", "nonhyeon"], ["서초", "seocho"], ["건대", "konkuk"],
];

const STOPWORDS =
  /\b(hair|hairdressing|dressing|salon|beauty|studio|shop|the|and|by|de|la|le|of|seoul|korea|branch|store|main|flagship|makeup|color|perm|cut|clinic|aesthetic|spa|nail|hongdae|seongsu|gangnam|myeongdong|apgujeong|cheongdam|sinsa|jamsil|itaewon|yeouido|hannam|sinchon|jongno|busan|edae|hapjeong|yeoksam|nonhyeon|seocho|konkuk|station|rodeo)\b/g;

/** Kakao names carry a branch suffix our English names don't: "로나 청담본점",
    "이철헤어커커 강남점", "에코쟈뎅 천호점". Left in, the location eats most of
    the bigram overlap and a correct match scores like a wrong one. */
export function stripBranch(korean) {
  return String(korean ?? "")
    .replace(/\s*[가-힣A-Za-z0-9]*(?:본점|직영점|지점|점)\s*$/u, "")
    .trim() || String(korean ?? "").trim();
}

/**
 * Collapse the spelling choices that separate a romanized Korean name from the
 * English spelling of the same brand, so the two become comparable:
 *   ECO JARDIN → ecojardin ┐
 *   에코쟈뎅 → ekojyadeng  ┘ → both fold to ekojaden(g)
 * Korean has one liquid (ㄹ) for l/r, no /f/ or /v/, no c/q/x, and Revised
 * Romanization writes vowels as digraphs (eo/eu/ae/oe) that English loans
 * spell with a single letter. Glides (y/w) survive romanization but rarely
 * survive the English spelling.
 */
function phoneticFold(s) {
  return s
    .replace(/[^a-z0-9]/g, "")
    .replace(/ch/g, "") // protect ch before c→k
    .replace(/[cq]/g, "k")
    .replace(//g, "ch")
    .replace(/x/g, "ks")
    .replace(/[fv]/g, "b")
    .replace(/z/g, "j")
    .replace(/l/g, "r")
    .replace(/eo/g, "o")
    .replace(/eu/g, "u")
    .replace(/ae/g, "e")
    .replace(/oe/g, "e")
    .replace(/[yw]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** Normalized comparison key: loanwords folded, romanized, phonetically folded. */
export function nameKey(text) {
  let s = String(text ?? "").toLowerCase();
  for (const [kr, en] of LOANWORDS) s = s.split(kr).join(en);
  return phoneticFold(romanize(s).toLowerCase());
}

/** Same, minus the generic words every salon shares — the distinctive part. */
export function distinctiveKey(text) {
  let s = String(text ?? "").toLowerCase();
  for (const [kr, en] of LOANWORDS) s = s.split(kr).join(` ${en} `);
  s = romanize(s).toLowerCase().replace(/[^a-z0-9]+/g, " ");
  s = ` ${s} `.replace(STOPWORDS, " ");
  return phoneticFold(s);
}

function bigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Sørensen–Dice on character bigrams, 0..1. */
export function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

/**
 * Overlap coefficient — how much of the SHORTER name the longer one contains.
 * One side is routinely a superset ("BLOOM 9" ⊂ "블룸9헤어"), which Dice
 * punishes. Heavily guarded, because this is the metric that goes wrong: a
 * short key finds its handful of bigrams inside a long one by chance and
 * scores 1.0 ("한스헤어" ⊂ "Duvel Hair Sungshin Women's University Branch").
 * So both keys must be substantial AND comparable in length.
 */
function containment(a, b) {
  const short = Math.min(a.length, b.length);
  const long = Math.max(a.length, b.length);
  if (short < 6 || short / long < 0.5) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return shared / Math.min(A.size, B.size);
}

/**
 * How much a Kakao Korean place name looks like our English name, 0..1.
 *
 * Scored on the DISTINCTIVE parts, not the whole name: "헤어" folds to "hair",
 * so a whole-name comparison hands every Korean salon a free overlap with
 * every English salon and the generic half of the name decides the match. The
 * full-name key is only the fallback for names that are nothing but generic
 * words, and it never gets the containment boost.
 */
export function nameSimilarity(english, korean) {
  return nameEvidence(english, korean).similarity;
}

/**
 * The score plus the raw evidence behind it. `shared` is the number of
 * character bigrams the two keys actually have in common — a ratio alone lets
 * two short keys reach 0.57 off two accidental bigrams ("sonso" ↔ "sonha",
 * Soonsoo Celebrity ↔ 선화 청담, which is a different salon), so the caller
 * also gets to demand a floor on the absolute overlap.
 */
export function nameEvidence(english, korean) {
  const kr = stripBranch(korean);
  const dEn = distinctiveKey(english);
  const dKr = distinctiveKey(kr);
  const distinctive = dEn.length >= 3 && dKr.length >= 3;
  const a = distinctive ? dEn : nameKey(english);
  const b = distinctive ? dKr : nameKey(kr);
  const similarity = distinctive ? Math.max(dice(a, b), containment(a, b)) : dice(a, b);
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return { similarity, shared, distinctive, keys: [a, b] };
}

/** A Latin run of ≥4 chars that both names literally share ("ANN", "MUE").
    Korean salon signage often keeps the brand in Latin inside a Korean name. */
export function sharedLatinToken(english, korean) {
  const en = String(english ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const kr = String(korean ?? "").toLowerCase();
  for (const t of en) {
    if (STOPWORDS.test(` ${t} `)) {
      STOPWORDS.lastIndex = 0;
      continue;
    }
    STOPWORDS.lastIndex = 0;
    if (kr.includes(t)) return t;
  }
  return null;
}

/** Turn a Korean branch suffix into an English store title.
    "Olive Young 청담역점" → "Olive Young Cheongdam Stn."
    "Olive Young 학동중앙점" → "Olive Young Hakdongjungang"
    The app is English-first for visitors, so a title that is half Korean is
    unreadable to its audience; the Korean stays in nameKr where it belongs
    (owner decision 2026-08-23). */
const TITLE_SUFFIXES = [
  [/역점$/, " Stn."],
  [/역$/, " Stn."],
  [/구청점$/, "-gu Office"],
  [/타운$/, " Town"],
  [/거리점$/, " St."],
  [/점$/, ""],
];
export function englishizeName(name) {
  return name.replace(/[가-힣][가-힣0-9]*/g, (run) => {
    let tail = "";
    let core = run;
    for (const [re, replacement] of TITLE_SUFFIXES) {
      if (re.test(core)) {
        core = core.replace(re, "");
        tail = replacement;
        break;
      }
    }
    if (!core) return tail.trim();
    const roman = romanize(core);
    if (!roman) return run;
    return roman.charAt(0).toUpperCase() + roman.slice(1) + tail;
  }).replace(/\s{2,}/g, " ").trim();
}
