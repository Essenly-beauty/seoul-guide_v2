import type { Place } from "./data";
import {
  ENGLISH_SUPPORT_VERDICTS,
  FIELD_VERDICTS,
  HOURS_VERDICTS,
  IDENTITY_VERDICTS,
  MEDIA_VERDICTS,
  PLACE_AUDIT_SCHEMA_VERSION,
  PIN_VERDICTS,
  PROPOSED_ACTIONS,
  type FieldVerdict,
  type HoursVerdict,
  type HumanPlaceVerdict,
  type HumanPlaceVerdictFile,
  type IdentityVerdict,
  type PinVerdict,
  type ProposedAction,
} from "./place-audit";

type CataloguePlace = Pick<Place, "id" | "source">;
type PlaceSource = NonNullable<Place["source"]>;

export type PlaceAuditBatchVerdict = {
  identity: IdentityVerdict;
  name: FieldVerdict;
  address: FieldVerdict;
  pin: PinVerdict;
  hours: HoursVerdict;
  naverEnglish: IdentityVerdict;
  proposedAction: ProposedAction;
  reviewedAt: string;
  reviewer: string;
  notes: string;
  evidenceLinks: string[];
};

export type PlaceAuditObservation = {
  nameKr: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  naverPlaceId: string | null;
};

export type PlaceAuditBatchPlace = {
  verdict: PlaceAuditBatchVerdict;
  observed: PlaceAuditObservation;
};

export type PlaceAuditBatch = {
  schemaVersion: typeof PLACE_AUDIT_SCHEMA_VERSION;
  source: PlaceSource;
  reviewedAt: string;
  places: Record<string, PlaceAuditBatchPlace>;
};

const SOURCES = ["curated", "creatrip", "kakao", "ados", "daiso"] as const;
const TOP_LEVEL_KEYS = ["schemaVersion", "source", "reviewedAt", "places"];
const PLACE_KEYS = ["verdict", "observed"];
const VERDICT_KEYS = [
  "identity",
  "name",
  "address",
  "pin",
  "hours",
  "naverEnglish",
  "proposedAction",
  "reviewedAt",
  "reviewer",
  "notes",
  "evidenceLinks",
];

const RESEARCH_FIELDS = ["identity", "name", "address", "pin", "hours", "naverEnglish"] as const;
type ResearchField = typeof RESEARCH_FIELDS[number];
const OBSERVED_KEYS = ["nameKr", "address", "latitude", "longitude", "naverPlaceId"];
const BASE_VERDICT_KEYS = [
  "identity",
  "name",
  "address",
  "pin",
  "hours",
  "englishSupport",
  "naverEnglish",
  "media",
  "proposedAction",
  "reviewedAt",
  "reviewer",
  "notes",
  "evidenceLinks",
  "naverPlaceId",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const expectedSet = new Set(expected);
  const unknown = Object.keys(value).filter((key) => !expectedSet.has(key)).sort();
  if (unknown.length) throw new Error(`Unknown ${label} field: ${unknown[0]}`);
  const missing = expected.filter((key) => !(key in value));
  if (missing.length) throw new Error(`Missing ${label} field: ${missing[0]}`);
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  placeId?: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Invalid ${field}${placeId ? ` for ${placeId}` : ""}: ${String(value)}`);
  }
}

function assertString(value: unknown, field: string, placeId?: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field}${placeId ? ` for ${placeId}` : ""}: ${String(value)}`);
  }
}

function assertDate(value: unknown, field: string, placeId?: string): asserts value is string {
  assertString(value, field, placeId);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const timestamp = match
    ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : Number.NaN;
  const canonical = Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString().slice(0, 10);
  if (canonical !== value) {
    throw new Error(`Invalid ${field}${placeId ? ` for ${placeId}` : ""}: ${value}`);
  }
}

function assertNullableNumber(value: unknown, field: string, placeId: string): asserts value is number | null {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`Invalid ${field} for ${placeId}: ${String(value)}`);
  }
}

function parseEvidenceLinks(value: unknown, placeId: string): string[] {
  if (!Array.isArray(value) || value.some((link) => typeof link !== "string")) {
    throw new Error(`Invalid evidenceLinks for ${placeId}`);
  }
  for (const link of value) {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:") throw new Error("Evidence must use HTTPS");
    } catch {
      throw new Error(`Invalid evidence link for ${placeId}: ${link}`);
    }
  }
  return [...new Set(value)].sort();
}

const NAVER_EVIDENCE_HOSTS = new Set([
  "map.naver.com",
  "m.place.naver.com",
  "pcmap.place.naver.com",
]);
const NAVER_PLACE_CATEGORY_ROUTES = new Set([
  "place",
  "restaurant",
  "hairshop",
  "hospital",
  "nailshop",
]);

function parseNaverUrl(link: string): URL | undefined {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || !NAVER_EVIDENCE_HOSTS.has(url.hostname)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function naverDetailPlaceId(link: string): string | undefined {
  const url = parseNaverUrl(link);
  if (!url) return undefined;
  if (url.hostname === "map.naver.com") {
    return /^\/(?:p|v5)\/(?:entry\/)?place\/([1-9]\d*)(?:\/|$)/u.exec(url.pathname)?.[1];
  }
  const match = /^\/([a-z][a-z0-9-]*)\/([1-9]\d*)(?:\/|$)/u.exec(url.pathname);
  if (!match || !NAVER_PLACE_CATEGORY_ROUTES.has(match[1])) return undefined;
  return match[2];
}

function hasNaverEvidence(links: readonly string[]): boolean {
  return links.some((link) => parseNaverUrl(link) !== undefined);
}

function validateNaverPlaceId(value: unknown, placeId: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !/^[1-9]\d*$/u.test(value)) {
    throw new Error(`Invalid Naver place id for ${placeId}: ${String(value)}`);
  }
  return value;
}

function validateResearchEvidence(
  placeId: string,
  verdict: HumanPlaceVerdict,
  evidenceLinks: readonly string[],
  naverPlaceId: string | undefined,
): void {
  const hasNaverVerdict =
    (verdict.identity !== undefined && verdict.identity !== "unchecked") ||
    (verdict.naverEnglish !== undefined && verdict.naverEnglish !== "unchecked");
  if (hasNaverVerdict && !hasNaverEvidence(evidenceLinks)) {
    throw new Error(`Missing Naver evidence link for ${placeId}`);
  }
  if (hasCompletedResearchField(verdict) && evidenceLinks.length === 0) {
    throw new Error(`Missing evidence link for ${placeId}`);
  }

  if (verdict.identity !== "matched" && verdict.naverEnglish !== "matched") return;
  if (!naverPlaceId) throw new Error(`Missing Naver place id for ${placeId}`);
  const detailIds = evidenceLinks.flatMap((link) => {
    const id = naverDetailPlaceId(link);
    return id ? [id] : [];
  });
  if (!detailIds.length) {
    throw new Error(`Missing matching Naver place detail link for ${placeId}`);
  }
  if (detailIds.some((detailId) => detailId !== naverPlaceId)) {
    throw new Error(`Naver place detail link does not match place id for ${placeId}`);
  }
}

function fieldIsCompleted(verdict: HumanPlaceVerdict | undefined, field: ResearchField): boolean {
  const value = verdict?.[field];
  return value !== undefined && value !== "unchecked";
}

function batchFieldIsCompleted(place: PlaceAuditBatchPlace, field: ResearchField): boolean {
  return place.verdict[field] !== "unchecked";
}

function hasCompletedResearchField(verdict: HumanPlaceVerdict): boolean {
  return RESEARCH_FIELDS.some((field) => fieldIsCompleted(verdict, field));
}

function parseBatchPlace(
  placeId: string,
  value: unknown,
  batchReviewedAt: string,
): PlaceAuditBatchPlace {
  assertRecord(value, `Place ${placeId}`);
  assertExactKeys(value, PLACE_KEYS, `place ${placeId}`);

  const verdict = value.verdict;
  assertRecord(verdict, `Verdict for ${placeId}`);
  assertExactKeys(verdict, VERDICT_KEYS, `verdict for ${placeId}`);
  assertEnum(verdict.identity, IDENTITY_VERDICTS, "identity", placeId);
  assertEnum(verdict.name, FIELD_VERDICTS, "name", placeId);
  assertEnum(verdict.address, FIELD_VERDICTS, "address", placeId);
  assertEnum(verdict.pin, PIN_VERDICTS, "pin", placeId);
  assertEnum(verdict.hours, HOURS_VERDICTS, "hours", placeId);
  assertEnum(verdict.naverEnglish, IDENTITY_VERDICTS, "naverEnglish", placeId);
  assertEnum(verdict.proposedAction, PROPOSED_ACTIONS, "proposedAction", placeId);
  assertDate(verdict.reviewedAt, "reviewedAt", placeId);
  if (verdict.reviewedAt !== batchReviewedAt) {
    throw new Error(`Reviewed date for ${placeId} does not match batch: ${verdict.reviewedAt}`);
  }
  assertString(verdict.reviewer, "reviewer", placeId);
  assertString(verdict.notes, "notes", placeId);
  if (!verdict.reviewer.trim()) throw new Error(`Missing reviewer for ${placeId}`);
  if (!verdict.notes.trim()) throw new Error(`Missing notes for ${placeId}`);
  const evidenceLinks = parseEvidenceLinks(verdict.evidenceLinks, placeId);

  const observed = value.observed;
  assertRecord(observed, `Observed data for ${placeId}`);
  assertExactKeys(observed, OBSERVED_KEYS, `observed data for ${placeId}`);
  assertString(observed.nameKr, "observed.nameKr", placeId);
  assertString(observed.address, "observed.address", placeId);
  assertNullableNumber(observed.latitude, "observed.latitude", placeId);
  assertNullableNumber(observed.longitude, "observed.longitude", placeId);
  if (observed.latitude !== null && (observed.latitude < -90 || observed.latitude > 90)) {
    throw new Error(`Invalid observed.latitude for ${placeId}: ${observed.latitude}`);
  }
  if (observed.longitude !== null && (observed.longitude < -180 || observed.longitude > 180)) {
    throw new Error(`Invalid observed.longitude for ${placeId}: ${observed.longitude}`);
  }
  const naverPlaceId = validateNaverPlaceId(observed.naverPlaceId, placeId);
  validateResearchEvidence(placeId, verdict, evidenceLinks, naverPlaceId);

  if (verdict.proposedAction === "correct") {
    const repairsName = verdict.name === "differs" || verdict.name === "missing";
    const repairsAddress = verdict.address === "differs" || verdict.address === "missing";
    const repairsPin = verdict.pin === "mismatch" || verdict.pin === "approximate";
    if (!repairsName && !repairsAddress && !repairsPin) {
      throw new Error(`Correction for ${placeId} has no repairable field`);
    }
    if (repairsName && !observed.nameKr.trim()) {
      throw new Error(`Missing observed nameKr for correction: ${placeId}`);
    }
    if (repairsAddress && !observed.address.trim()) {
      throw new Error(`Missing observed address for correction: ${placeId}`);
    }
    if (repairsPin && (observed.latitude === null || observed.longitude === null)) {
      throw new Error(`Missing observed coordinates for correction: ${placeId}`);
    }
  }
  if ((observed.latitude === null) !== (observed.longitude === null)) {
    throw new Error(`Observed coordinates must both be null or both numbers for ${placeId}`);
  }

  return {
    verdict: {
      identity: verdict.identity,
      name: verdict.name,
      address: verdict.address,
      pin: verdict.pin,
      hours: verdict.hours,
      naverEnglish: verdict.naverEnglish,
      proposedAction: verdict.proposedAction,
      reviewedAt: verdict.reviewedAt,
      reviewer: verdict.reviewer,
      notes: verdict.notes,
      evidenceLinks,
    },
    observed: {
      nameKr: observed.nameKr,
      address: observed.address,
      latitude: observed.latitude,
      longitude: observed.longitude,
      naverPlaceId: naverPlaceId ?? null,
    },
  };
}

export function parsePlaceAuditBatch(
  input: unknown,
  catalogue: readonly CataloguePlace[],
): PlaceAuditBatch {
  assertRecord(input, "Place audit batch");
  assertExactKeys(input, TOP_LEVEL_KEYS, "batch");
  if (input.schemaVersion !== PLACE_AUDIT_SCHEMA_VERSION) {
    throw new Error(`Unsupported place audit batch schema: ${String(input.schemaVersion)}`);
  }
  assertEnum(input.source, SOURCES, "batch source");
  assertDate(input.reviewedAt, "batch reviewedAt");
  assertRecord(input.places, "Batch places");

  const catalogueById = new Map(catalogue.map((place) => [place.id, place]));
  const places: Record<string, PlaceAuditBatchPlace> = {};
  for (const placeId of Object.keys(input.places).sort()) {
    const cataloguePlace = catalogueById.get(placeId);
    if (!cataloguePlace) throw new Error(`Unknown place id in batch: ${placeId}`);
    if (cataloguePlace.source !== input.source) {
      throw new Error(`Batch source ${input.source} does not match ${placeId} source ${cataloguePlace.source ?? "unknown"}`);
    }
    places[placeId] = parseBatchPlace(placeId, input.places[placeId], input.reviewedAt);
  }

  return {
    schemaVersion: PLACE_AUDIT_SCHEMA_VERSION,
    source: input.source,
    reviewedAt: input.reviewedAt,
    places,
  };
}

function batchVerdictToHuman(place: PlaceAuditBatchPlace): HumanPlaceVerdict {
  const verdict = place.verdict;
  return {
    ...(verdict.identity !== "unchecked" ? { identity: verdict.identity } : {}),
    ...(verdict.name !== "unchecked" ? { name: verdict.name } : {}),
    ...(verdict.address !== "unchecked" ? { address: verdict.address } : {}),
    ...(verdict.pin !== "unchecked" ? { pin: verdict.pin } : {}),
    ...(verdict.hours !== "unchecked" ? { hours: verdict.hours } : {}),
    ...(verdict.naverEnglish !== "unchecked" ? { naverEnglish: verdict.naverEnglish } : {}),
    proposedAction: verdict.proposedAction,
    reviewedAt: verdict.reviewedAt,
    reviewer: verdict.reviewer,
    notes: verdict.notes,
    evidenceLinks: [...verdict.evidenceLinks].sort(),
    ...(place.observed.naverPlaceId ? { naverPlaceId: place.observed.naverPlaceId } : {}),
  };
}

export function parseHumanPlaceVerdictFile(input: unknown): HumanPlaceVerdictFile {
  assertRecord(input, "Base verdict file");
  assertExactKeys(input, ["schemaVersion", "places"], "base verdict file");
  if (input.schemaVersion !== PLACE_AUDIT_SCHEMA_VERSION) {
    throw new Error(`Unsupported place audit schema: ${String(input.schemaVersion)}`);
  }
  assertRecord(input.places, "Base verdict places");
  const rawPlaces: Record<string, unknown> = input.places;

  const places: Record<string, HumanPlaceVerdict> = {};
  for (const placeId of Object.keys(rawPlaces).sort()) {
    const value: unknown = rawPlaces[placeId];
    assertRecord(value, `Base verdict for ${placeId}`);
    const unknown = Object.keys(value).filter((key) => !BASE_VERDICT_KEYS.includes(key)).sort();
    if (unknown.length) throw new Error(`Unknown base verdict field for ${placeId}: ${unknown[0]}`);
    if (value.identity !== undefined) assertEnum(value.identity, IDENTITY_VERDICTS, "identity", placeId);
    if (value.name !== undefined) assertEnum(value.name, FIELD_VERDICTS, "name", placeId);
    if (value.address !== undefined) assertEnum(value.address, FIELD_VERDICTS, "address", placeId);
    if (value.pin !== undefined) assertEnum(value.pin, PIN_VERDICTS, "pin", placeId);
    if (value.hours !== undefined) assertEnum(value.hours, HOURS_VERDICTS, "hours", placeId);
    if (value.englishSupport !== undefined) {
      assertEnum(value.englishSupport, ENGLISH_SUPPORT_VERDICTS, "englishSupport", placeId);
    }
    if (value.naverEnglish !== undefined) {
      assertEnum(value.naverEnglish, IDENTITY_VERDICTS, "naverEnglish", placeId);
    }
    if (value.media !== undefined) assertEnum(value.media, MEDIA_VERDICTS, "media", placeId);
    if (value.proposedAction !== undefined) {
      assertEnum(value.proposedAction, PROPOSED_ACTIONS, "proposedAction", placeId);
    }
    if (value.reviewedAt !== undefined) assertDate(value.reviewedAt, "reviewedAt", placeId);
    if (value.reviewer !== undefined) assertString(value.reviewer, "reviewer", placeId);
    if (value.notes !== undefined) assertString(value.notes, "notes", placeId);
    const evidenceLinks = value.evidenceLinks === undefined
      ? undefined
      : parseEvidenceLinks(value.evidenceLinks, placeId);
    const naverPlaceId = validateNaverPlaceId(value.naverPlaceId, placeId);
    const parsed = {
      ...value,
      ...(evidenceLinks ? { evidenceLinks } : {}),
      ...(naverPlaceId ? { naverPlaceId } : {}),
    } as HumanPlaceVerdict;
    if (hasCompletedResearchField(parsed)) {
      if (parsed.reviewedAt === undefined) throw new Error(`Missing reviewedAt for ${placeId}`);
      if (parsed.reviewer === undefined || !parsed.reviewer.trim()) {
        throw new Error(`Missing reviewer for ${placeId}`);
      }
      if (parsed.notes === undefined || !parsed.notes.trim()) throw new Error(`Missing notes for ${placeId}`);
    }
    validateResearchEvidence(placeId, parsed, evidenceLinks ?? [], naverPlaceId);
    places[placeId] = parsed;
  }

  return { schemaVersion: PLACE_AUDIT_SCHEMA_VERSION, places };
}

export function validatePlaceAuditBatchCoverage(
  batches: readonly PlaceAuditBatch[],
  catalogue: readonly CataloguePlace[],
  base: HumanPlaceVerdictFile,
): void {
  const validatedBase = parseHumanPlaceVerdictFile(base);
  const includedSources = [...new Set(batches.map((batch) => batch.source))].sort();
  const expectedSources = [...new Set(
    catalogue
      .filter((place) => place.source !== undefined)
      .filter((place) => RESEARCH_FIELDS.some((field) => !fieldIsCompleted(validatedBase.places[place.id], field)))
      .map((place) => place.source as PlaceSource),
  )].sort();

  for (const source of expectedSources) {
    if (!includedSources.includes(source)) {
      throw new Error(`Missing batch for unchecked source: ${source}`);
    }
  }

  const sourcesToValidate = [...new Set([...expectedSources, ...includedSources])].sort();
  for (const source of sourcesToValidate) {
    const expected = new Set(
      catalogue
        .filter((place) => place.source === source)
        .filter((place) => RESEARCH_FIELDS.some((field) => !fieldIsCompleted(validatedBase.places[place.id], field)))
        .map((place) => place.id),
    );
    const sourceBatches = batches.filter((batch) => batch.source === source);
    const rawActual = new Set(sourceBatches.flatMap((batch) => Object.keys(batch.places)));
    const actual = new Set(
      sourceBatches
        .flatMap((batch) => Object.entries(batch.places))
        .filter(([placeId, batchPlace]) => RESEARCH_FIELDS.some(
          (field) => !fieldIsCompleted(validatedBase.places[placeId], field) && batchFieldIsCompleted(batchPlace, field),
        ))
        .map(([placeId]) => placeId),
    );
    const missing = [...expected].filter((placeId) => !actual.has(placeId)).sort();
    if (missing.length) {
      throw new Error(`Missing unchecked ${source} place ids from batches: ${missing.join(", ")}`);
    }
    const unexpected = [...rawActual].filter((placeId) => !expected.has(placeId)).sort();
    if (unexpected.length) {
      throw new Error(`Batch includes non-unchecked ${source} place ids: ${unexpected.join(", ")}`);
    }
  }
}

type ReviewProvenance = {
  reviewedAt: string;
  reviewer: string;
  note: string;
};

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function formatReviewProvenance(entries: readonly ReviewProvenance[]): string {
  return entries
    .map((entry) => `[${entry.reviewedAt} — ${entry.reviewer}] ${entry.note}`)
    .join("\n\n");
}

function parseFormattedReviewProvenance(notes: string): ReviewProvenance[] | undefined {
  const header = /\[(\d{4}-\d{2}-\d{2}) — ([^\]\n]+)\] /gu;
  const matches = [...notes.matchAll(header)];
  if (!matches.length || matches[0].index !== 0) return undefined;
  const entries: ReviewProvenance[] = [];
  for (const [index, match] of matches.entries()) {
    const nextIndex = matches[index + 1]?.index ?? notes.length;
    const noteEnd = index + 1 < matches.length ? nextIndex - 2 : nextIndex;
    if (index + 1 < matches.length && notes.slice(noteEnd, nextIndex) !== "\n\n") return undefined;
    entries.push({
      reviewedAt: match[1],
      reviewer: match[2],
      note: notes.slice((match.index ?? 0) + match[0].length, noteEnd),
    });
  }
  return formatReviewProvenance(entries) === notes ? entries : undefined;
}

function reviewProvenance(verdict: HumanPlaceVerdict | undefined): ReviewProvenance[] {
  if (!verdict?.reviewedAt || !verdict.reviewer || !verdict.notes) return [];
  return parseFormattedReviewProvenance(verdict.notes) ?? [{
    reviewedAt: verdict.reviewedAt,
    reviewer: verdict.reviewer,
    note: verdict.notes,
  }];
}

function mergedReviewMetadata(
  current: HumanPlaceVerdict | undefined,
  incoming: HumanPlaceVerdict,
): Pick<HumanPlaceVerdict, "reviewedAt" | "reviewer" | "notes"> {
  const unique = new Map<string, ReviewProvenance>();
  for (const entry of [...reviewProvenance(current), ...reviewProvenance(incoming)]) {
    unique.set(JSON.stringify([entry.reviewedAt, entry.reviewer, entry.note]), entry);
  }
  const entries = [...unique.values()].sort((first, second) =>
    compareText(first.reviewedAt, second.reviewedAt) ||
    compareText(first.reviewer, second.reviewer) ||
    compareText(first.note, second.note));
  const reviewers = [...new Set(entries.map((entry) => entry.reviewer))].sort(compareText);
  return {
    reviewedAt: entries.at(-1)?.reviewedAt,
    reviewer: reviewers.join("; "),
    notes: formatReviewProvenance(entries),
  };
}

function mergeBatchPlace(
  placeId: string,
  base: HumanPlaceVerdict | undefined,
  current: HumanPlaceVerdict | undefined,
  batchPlace: PlaceAuditBatchPlace,
  completedByBatch: Set<ResearchField>,
): HumanPlaceVerdict {
  const incoming = batchVerdictToHuman(batchPlace);
  for (const field of RESEARCH_FIELDS) {
    if (!fieldIsCompleted(incoming, field)) continue;
    if (fieldIsCompleted(base, field)) {
      throw new Error(`Completed base ${field} would be overwritten: ${placeId}`);
    }
    if (completedByBatch.has(field)) {
      throw new Error(`Duplicate place id across batches: ${placeId}`);
    }
  }
  if (current?.naverPlaceId && incoming.naverPlaceId && current.naverPlaceId !== incoming.naverPlaceId) {
    throw new Error(`Conflicting Naver place id across verdicts: ${placeId}`);
  }
  if (hasCompletedResearchField(current ?? {}) && current?.proposedAction &&
      current.proposedAction !== incoming.proposedAction) {
    throw new Error(
      `Conflicting proposedAction for ${placeId}: ${current.proposedAction} vs ${incoming.proposedAction}`,
    );
  }

  const metadata = mergedReviewMetadata(current, incoming);
  const next: HumanPlaceVerdict = {
    ...current,
    proposedAction: hasCompletedResearchField(current ?? {})
      ? current?.proposedAction ?? incoming.proposedAction
      : incoming.proposedAction,
    reviewedAt: metadata.reviewedAt,
    reviewer: metadata.reviewer,
    notes: metadata.notes,
    evidenceLinks: [...new Set([...(current?.evidenceLinks ?? []), ...(incoming.evidenceLinks ?? [])])].sort(),
    ...(current?.naverPlaceId || incoming.naverPlaceId
      ? { naverPlaceId: current?.naverPlaceId ?? incoming.naverPlaceId }
      : {}),
  };
  for (const field of RESEARCH_FIELDS) {
    if (!fieldIsCompleted(incoming, field)) continue;
    (next as Record<ResearchField, unknown>)[field] = incoming[field];
    completedByBatch.add(field);
  }
  return next;
}

export function mergePlaceAuditBatches(
  base: HumanPlaceVerdictFile,
  batches: readonly PlaceAuditBatch[],
): HumanPlaceVerdictFile {
  const validatedBase = parseHumanPlaceVerdictFile(base);
  const merged: Record<string, HumanPlaceVerdict> = { ...validatedBase.places };
  const completedByBatch = new Map<string, Set<ResearchField>>();
  for (const batch of batches) {
    for (const placeId of Object.keys(batch.places).sort()) {
      const completed = completedByBatch.get(placeId) ?? new Set<ResearchField>();
      merged[placeId] = mergeBatchPlace(
        placeId,
        validatedBase.places[placeId],
        merged[placeId],
        batch.places[placeId],
        completed,
      );
      completedByBatch.set(placeId, completed);
    }
  }

  return parseHumanPlaceVerdictFile({
    schemaVersion: PLACE_AUDIT_SCHEMA_VERSION,
    places: Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b))),
  });
}
