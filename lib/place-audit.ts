import type { Place } from "./data";

export const PLACE_AUDIT_SCHEMA_VERSION = 1 as const;

export const IDENTITY_VERDICTS = ["matched", "mismatch", "ambiguous", "not_found", "unchecked"] as const;
export const FIELD_VERDICTS = ["matched", "differs", "missing", "unchecked"] as const;
export const PIN_VERDICTS = ["exact", "approximate", "mismatch", "unchecked"] as const;
export const HOURS_VERDICTS = ["verified", "stale", "missing", "differs", "unchecked"] as const;
export const ENGLISH_SUPPORT_VERDICTS = ["verified_yes", "verified_no", "unknown"] as const;
export const MEDIA_VERDICTS = ["licensed_photo", "ai_illustration", "none", "rights_unknown"] as const;
export const PROPOSED_ACTIONS = ["keep", "correct", "hide", "investigate"] as const;

export type IdentityVerdict = typeof IDENTITY_VERDICTS[number];
export type FieldVerdict = typeof FIELD_VERDICTS[number];
export type PinVerdict = typeof PIN_VERDICTS[number];
export type HoursVerdict = typeof HOURS_VERDICTS[number];
export type EnglishSupportVerdict = typeof ENGLISH_SUPPORT_VERDICTS[number];
export type MediaVerdict = typeof MEDIA_VERDICTS[number];
export type ProposedAction = typeof PROPOSED_ACTIONS[number];

export type HumanPlaceVerdict = {
  identity?: IdentityVerdict;
  name?: FieldVerdict;
  address?: FieldVerdict;
  pin?: PinVerdict;
  hours?: HoursVerdict;
  englishSupport?: EnglishSupportVerdict;
  /** Whether searching the exact public English display name in Naver Map resolves this venue. */
  naverEnglish?: IdentityVerdict;
  media?: MediaVerdict;
  proposedAction?: ProposedAction;
  reviewedAt?: string;
  reviewer?: string;
  notes?: string;
  evidenceLinks?: string[];
  /** Canonical numeric Naver venue id when a matched verdict is recorded. */
  naverPlaceId?: string;
};

export type HumanPlaceVerdictFile = {
  schemaVersion: typeof PLACE_AUDIT_SCHEMA_VERSION;
  places: Record<string, HumanPlaceVerdict>;
};

export type KakaoHoursEvidence = {
  kakaoPlaceId: string;
  kakaoName: string;
  openDays: number;
};

export type ProviderSearchLinks = {
  google: string;
  naver: string;
  naverEnglish: string;
  kakao: string;
};

export type PlaceAuditEntry = {
  id: string;
  name: string;
  nameKr: string;
  source: NonNullable<Place["source"]> | "unknown";
  type: Place["type"];
  address: string;
  lat: number;
  lng: number;
  providerSearch: ProviderSearchLinks;
  cachedKakaoEvidence?: KakaoHoursEvidence;
  verdicts: {
    identity: IdentityVerdict;
    name: FieldVerdict;
    address: FieldVerdict;
    pin: PinVerdict;
    hours: HoursVerdict;
    englishSupport: EnglishSupportVerdict;
    naverEnglish: IdentityVerdict;
    media: MediaVerdict;
    proposedAction: ProposedAction;
  };
  findings: string[];
  reviewedAt?: string;
  reviewer?: string;
  notes?: string;
  evidenceLinks: string[];
  naverPlaceId?: string;
};

export type PlaceAuditSummary = {
  total: number;
  bySource: Record<string, number>;
  byIdentity: Record<string, number>;
  byNaverEnglish: Record<string, number>;
  byAction: Record<string, number>;
  findings: Record<string, number>;
};

export function providerSearchLinks(place: Pick<Place, "name" | "nameKr" | "address">): ProviderSearchLinks {
  const query = [place.nameKr, place.address].filter(Boolean).join(" ");
  const encoded = encodeURIComponent(query);
  const englishName = encodeURIComponent(place.name.trim());
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    naver: `https://map.naver.com/p/search/${encoded}`,
    naverEnglish: `https://map.naver.com/p/search/${englishName}`,
    kakao: `https://map.kakao.com/link/search/${encoded}`,
  };
}

/** Detect display copy that should not be treated as a canonical map listing name. */
export function englishNameNeedsReview(name: string): boolean {
  return name.length > 72 || /[|#\[\]]|English[- ]Speaking|Foreigner[- ]Friendly|Reservation|Package|Deal/i.test(name);
}

function automaticFindings(place: Place, kakao?: KakaoHoursEvidence, duplicateCoordinate = false): string[] {
  return [
    ...(place.source === "curated" ? ["curated_prototype"] : []),
    ...(place.zone === "busan" || place.zone === "gyeonggi" || /^(부산|경기)\s/.test(place.address)
      ? ["outside_service_area"]
      : []),
    ...(place.geoSource === "area" ? ["approximate_pin"] : []),
    ...(duplicateCoordinate ? ["duplicate_coordinate"] : []),
    ...(!place.address ? ["missing_address"] : []),
    ...(!/[가-힣]/.test(place.nameKr) ? ["missing_korean_listing_name"] : []),
    ...(!place.hours ? ["missing_hours"] : []),
    ...(place.englishOk !== true ? ["english_support_unknown"] : []),
    ...(englishNameNeedsReview(place.name) ? ["english_name_marketing_copy"] : []),
    ...(place.source === "kakao" ? ["generated_english_romanization"] : []),
    ...(place.nameVerification === "provisional" ? ["provisional_english_name"] : []),
    ...(place.rating !== undefined ? ["source_rating_provenance_missing"] : []),
    ...(!(place.photos?.length || place.photoUrl) ? ["no_licensed_photo"] : []),
    ...(kakao ? ["cached_kakao_match"] : []),
  ].sort();
}

export function buildAuditEntries(
  places: readonly Place[],
  human: HumanPlaceVerdictFile,
  kakaoHours: Record<string, KakaoHoursEvidence>,
): PlaceAuditEntry[] {
  if (human.schemaVersion !== PLACE_AUDIT_SCHEMA_VERSION) {
    throw new Error(`Unsupported place audit schema: ${human.schemaVersion}`);
  }

  const ids = new Set(places.map((place) => place.id));
  const coordinateCounts = new Map<string, number>();
  for (const place of places) {
    const key = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
    coordinateCounts.set(key, (coordinateCounts.get(key) ?? 0) + 1);
  }
  const unknownVerdicts = Object.keys(human.places).filter((id) => !ids.has(id));
  if (unknownVerdicts.length) {
    throw new Error(`Unknown place ids in verdicts: ${unknownVerdicts.sort().join(", ")}`);
  }

  return places.map((place): PlaceAuditEntry => {
    const manual = human.places[place.id] ?? {};
    const kakao = kakaoHours[place.id];
    return {
      id: place.id,
      name: place.name,
      nameKr: place.nameKr,
      source: place.source ?? "unknown",
      type: place.type,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      providerSearch: providerSearchLinks(place),
      ...(kakao ? { cachedKakaoEvidence: kakao } : {}),
      verdicts: {
        identity: manual.identity ?? "unchecked",
        name: manual.name ?? "unchecked",
        address: manual.address ?? (!place.address ? "missing" : "unchecked"),
        pin: manual.pin ?? (place.geoSource === "area" ? "approximate" : "unchecked"),
        hours: manual.hours ?? (!place.hours ? "missing" : "unchecked"),
        englishSupport: manual.englishSupport ?? (place.englishOk === true ? "verified_yes" : "unknown"),
        naverEnglish: manual.naverEnglish ?? "unchecked",
        media: manual.media ?? (place.photos?.length || place.photoUrl ? "licensed_photo" : "none"),
        proposedAction: manual.proposedAction ??
          (place.zone === "busan" || place.zone === "gyeonggi" ? "hide" : "investigate"),
      },
      findings: automaticFindings(
        place,
        kakao,
        (coordinateCounts.get(`${place.lat.toFixed(6)},${place.lng.toFixed(6)}`) ?? 0) > 1,
      ),
      ...(manual.reviewedAt ? { reviewedAt: manual.reviewedAt } : {}),
      ...(manual.reviewer ? { reviewer: manual.reviewer } : {}),
      ...(manual.notes ? { notes: manual.notes } : {}),
      evidenceLinks: [...new Set(manual.evidenceLinks ?? [])].sort(),
      ...(manual.naverPlaceId ? { naverPlaceId: manual.naverPlaceId } : {}),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function sortedCounts(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

export function summarizePlaceAudit(entries: readonly PlaceAuditEntry[]): PlaceAuditSummary {
  const bySource: Record<string, number> = {};
  const byIdentity: Record<string, number> = {};
  const byNaverEnglish: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const findings: Record<string, number> = {};

  for (const entry of entries) {
    increment(bySource, entry.source);
    increment(byIdentity, entry.verdicts.identity);
    increment(byNaverEnglish, entry.verdicts.naverEnglish);
    increment(byAction, entry.verdicts.proposedAction);
    for (const finding of entry.findings) increment(findings, finding);
  }

  return {
    total: entries.length,
    bySource: sortedCounts(bySource),
    byIdentity: sortedCounts(byIdentity),
    byNaverEnglish: sortedCounts(byNaverEnglish),
    byAction: sortedCounts(byAction),
    findings: sortedCounts(findings),
  };
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderAuditMarkdown(
  entries: readonly PlaceAuditEntry[],
  summary: PlaceAuditSummary,
): string {
  const priorityFindings = new Set([
    "outside_service_area",
    "curated_prototype",
    "approximate_pin",
    "duplicate_coordinate",
    "missing_address",
    "english_name_marketing_copy",
    "missing_korean_listing_name",
    "generated_english_romanization",
    "provisional_english_name",
  ]);
  const priority = entries
    .filter((entry) => entry.findings.some((finding) => priorityFindings.has(finding)))
    .sort((a, b) => a.source.localeCompare(b.source) || a.id.localeCompare(b.id));

  const lines = [
    "# MYSEOULDROP place data audit",
    "",
    "This report is an internal review queue. `unchecked` does not mean invalid, and no row is deleted or hidden by this audit.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "|---|---:|",
    `| Total places | ${summary.total} |`,
    `| Identity matched | ${summary.byIdentity.matched ?? 0} |`,
    `| Identity unchecked | ${summary.byIdentity.unchecked ?? 0} |`,
    `| Naver English-name matched | ${summary.byNaverEnglish.matched ?? 0} |`,
    `| Naver English-name unchecked | ${summary.byNaverEnglish.unchecked ?? 0} |`,
    `| English names needing canonical-name review | ${summary.findings.english_name_marketing_copy ?? 0} |`,
    `| Missing Korean listing names | ${summary.findings.missing_korean_listing_name ?? 0} |`,
    `| Generated English romanizations needing review | ${summary.findings.generated_english_romanization ?? 0} |`,
    `| Provisional English place names | ${summary.findings.provisional_english_name ?? 0} |`,
    `| Outside Seoul service area | ${summary.findings.outside_service_area ?? 0} |`,
    `| Approximate pins | ${summary.findings.approximate_pin ?? 0} |`,
    `| Places sharing an exact coordinate | ${summary.findings.duplicate_coordinate ?? 0} |`,
    `| Missing hours | ${summary.findings.missing_hours ?? 0} |`,
    `| Cached Kakao matches | ${summary.findings.cached_kakao_match ?? 0} |`,
    `| No licensed photo | ${summary.findings.no_licensed_photo ?? 0} |`,
    "",
    "## Source coverage",
    "",
    "| Source | Count |",
    "|---|---:|",
    ...Object.entries(summary.bySource).map(([source, count]) => `| ${label(source)} | ${count} |`),
    "",
    "## Priority review queue",
    "",
    "| Place | Source | Identity | Naver EN | Action | Findings | Google | Naver (KO) | Naver (EN) | Kakao |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...priority.map((entry) => {
      const title = cell(`${entry.name} (${entry.nameKr})`);
      const findings = entry.findings.map(label).join(", ");
      return `| ${title} | ${entry.source} | ${label(entry.verdicts.identity)} | ${label(entry.verdicts.naverEnglish)} | ${label(entry.verdicts.proposedAction)} | ${findings} | [Search](${entry.providerSearch.google}) | [Search](${entry.providerSearch.naver}) | [Search](${entry.providerSearch.naverEnglish}) | [Search](${entry.providerSearch.kakao}) |`;
    }),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
