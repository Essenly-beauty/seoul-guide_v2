import { describe, expect, it } from "vitest";
import humanVerdicts from "../data/place-audit-verdicts.json";
import { CATALOGUE_PLACES } from "./data";
import {
  mergePlaceAuditBatches,
  parseHumanPlaceVerdictFile,
  parsePlaceAuditBatch,
  validatePlaceAuditBatchCoverage,
  type PlaceAuditBatch,
} from "./place-audit-batch";
import {
  FIELD_VERDICTS,
  HOURS_VERDICTS,
  IDENTITY_VERDICTS,
  PIN_VERDICTS,
  PROPOSED_ACTIONS,
  type HumanPlaceVerdictFile,
} from "./place-audit";

const place = CATALOGUE_PLACES.find((candidate) => candidate.source === "ados")!;
const secondPlace = CATALOGUE_PLACES.find(
  (candidate) => candidate.source === "ados" && candidate.id !== place.id,
)!;
const otherSourcePlace = CATALOGUE_PLACES.find((candidate) => candidate.source === "curated")!;
const NAVER_PLACE_ID = "123456789";
const NAVER_DETAIL_URL = `https://map.naver.com/p/entry/place/${NAVER_PLACE_ID}`;

function validBatch(): unknown {
  return {
    schemaVersion: 1,
    source: "ados",
    reviewedAt: "2026-08-30",
    places: {
      [place.id]: {
        verdict: {
          identity: "matched",
          name: "matched",
          address: "matched",
          pin: "unchecked",
          hours: "unchecked",
          naverEnglish: "not_found",
          proposedAction: "keep",
          reviewedAt: "2026-08-30",
          reviewer: "Independent Naver Map live review",
          notes: "The exact Korean listing and address resolve the same branch.",
          evidenceLinks: [NAVER_DETAIL_URL],
        },
        observed: {
          nameKr: place.nameKr,
          address: place.address,
          latitude: null,
          longitude: null,
          naverPlaceId: NAVER_PLACE_ID,
        },
      },
    },
  };
}

function researchBatch(identity: "matched" | "unchecked", naverEnglish: "matched" | "unchecked"): unknown {
  const input = validBatch() as PlaceAuditBatch;
  const target = input.places[place.id];
  target.verdict.identity = identity;
  target.verdict.name = "unchecked";
  target.verdict.address = "unchecked";
  target.verdict.pin = "unchecked";
  target.verdict.hours = "unchecked";
  target.verdict.naverEnglish = naverEnglish;
  return input;
}

function completedHuman(fields: { identity?: "matched"; naverEnglish?: "matched" }): HumanPlaceVerdictFile {
  return {
    schemaVersion: 1,
    places: {
      [place.id]: {
        ...fields,
        reviewedAt: "2026-08-30",
        reviewer: "Independent Naver Map live review",
        notes: "Venue-specific Naver place evidence was checked.",
        evidenceLinks: [NAVER_DETAIL_URL],
        naverPlaceId: NAVER_PLACE_ID,
        proposedAction: "keep",
      },
    },
  };
}

describe("place audit research batches", () => {
  it("exports the runtime verdict enums used by batch validation", () => {
    expect(IDENTITY_VERDICTS).toEqual(["matched", "mismatch", "ambiguous", "not_found", "unchecked"]);
    expect(FIELD_VERDICTS).toEqual(["matched", "differs", "missing", "unchecked"]);
    expect(PIN_VERDICTS).toEqual(["exact", "approximate", "mismatch", "unchecked"]);
    expect(HOURS_VERDICTS).toEqual(["verified", "stale", "missing", "differs", "unchecked"]);
    expect(PROPOSED_ACTIONS).toEqual(["keep", "correct", "hide", "investigate"]);
  });

  it("accepts an evidence-complete source-isolated batch", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);

    expect(parsed.source).toBe("ados");
    expect(parsed.places[place.id].verdict.identity).toBe("matched");
  });

  it("accepts Daiso as a catalogue audit source", () => {
    const daisoPlace = CATALOGUE_PLACES.find((candidate) => candidate.source === "daiso")!;
    const input = validBatch() as PlaceAuditBatch;
    const batchPlace = input.places[place.id];
    input.source = "daiso";
    input.places = {
      [daisoPlace.id]: {
        ...batchPlace,
        observed: {
          ...batchPlace.observed,
          nameKr: daisoPlace.nameKr,
          address: daisoPlace.address,
        },
      },
    };

    expect(parsePlaceAuditBatch(input, CATALOGUE_PLACES).source).toBe("daiso");
  });

  it("rejects unknown catalogue IDs", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places.missing = input.places[place.id];
    delete input.places[place.id];

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow("Unknown place id in batch: missing");
  });

  it("rejects invalid verdict enum values", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.identity = "probably" as "matched";

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Invalid identity for ${place.id}: probably`);
  });

  it("rejects completed verdicts without a Naver evidence link", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [];

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing Naver evidence link for ${place.id}`);
  });

  it("rejects identity matches backed only by a search URL or a missing place id", () => {
    const searchOnly = validBatch() as PlaceAuditBatch;
    searchOnly.places[place.id].verdict.evidenceLinks = ["https://map.naver.com/p/search/example"];
    expect(() => parsePlaceAuditBatch(searchOnly, CATALOGUE_PLACES))
      .toThrow(`Missing matching Naver place detail link for ${place.id}`);

    const missingId = validBatch() as PlaceAuditBatch;
    missingId.places[place.id].observed.naverPlaceId = null;
    expect(() => parsePlaceAuditBatch(missingId, CATALOGUE_PLACES))
      .toThrow(`Missing Naver place id for ${place.id}`);
  });

  it("does not mistake a place-looking search path for a venue detail URL", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [
      `https://map.naver.com/p/search/place/${NAVER_PLACE_ID}`,
    ];

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing matching Naver place detail link for ${place.id}`);
  });

  it("rejects identity matches whose detail URL identifies a different Naver place", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].observed.naverPlaceId = "987654321";

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Naver place detail link does not match place id for ${place.id}`);
  });

  it.each([
    `https://map.naver.com/p/entry/place/${NAVER_PLACE_ID}`,
    `https://map.naver.com/p/place/${NAVER_PLACE_ID}?c=15.00,0,0,0,dh`,
    `https://map.naver.com/v5/entry/place/${NAVER_PLACE_ID}`,
    `https://m.place.naver.com/place/${NAVER_PLACE_ID}/home`,
    `https://m.place.naver.com/restaurant/${NAVER_PLACE_ID}/home`,
    `https://m.place.naver.com/hairshop/${NAVER_PLACE_ID}/home`,
    `https://pcmap.place.naver.com/place/${NAVER_PLACE_ID}/home`,
    `https://pcmap.place.naver.com/restaurant/${NAVER_PLACE_ID}/home`,
    `https://pcmap.place.naver.com/hairshop/${NAVER_PLACE_ID}/home`,
  ])("accepts a venue-specific Naver detail URL pattern: %s", (url) => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [url];

    expect(parsePlaceAuditBatch(input, CATALOGUE_PLACES).places[place.id].observed.naverPlaceId)
      .toBe(NAVER_PLACE_ID);
  });

  it.each([
    ["https://m.place.naver.com/hospital/37668348/home", "37668348"],
    ["https://m.place.naver.com/nailshop/1822434435/home", "1822434435"],
  ])("accepts a reviewed mobile Naver category route: %s", (url, naverPlaceId) => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [url];
    input.places[place.id].observed.naverPlaceId = naverPlaceId;

    expect(parsePlaceAuditBatch(input, CATALOGUE_PLACES).places[place.id].observed.naverPlaceId)
      .toBe(naverPlaceId);
  });

  it.each([
    `https://m.place.naver.com/search/${NAVER_PLACE_ID}/home`,
    "https://m.place.naver.com/restaurant/not-a-number/home",
  ])("rejects a malformed or non-venue mobile Naver path: %s", (url) => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [url];

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing matching Naver place detail link for ${place.id}`);
  });

  it("rejects a host-spoofed mobile Naver detail URL", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.evidenceLinks = [
      `https://m.place.naver.com.evil.example/restaurant/${NAVER_PLACE_ID}/home`,
    ];

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing Naver evidence link for ${place.id}`);
  });

  it.each([
    ["name", "matched"],
    ["address", "matched"],
    ["pin", "exact"],
    ["hours", "verified"],
  ] as const)("requires a valid evidence URL for a field-only %s verdict", (field, value) => {
    const input = researchBatch("unchecked", "unchecked") as PlaceAuditBatch;
    const target = input.places[place.id];
    Object.assign(target.verdict, { [field]: value });
    target.verdict.evidenceLinks = [];
    target.observed.naverPlaceId = null;
    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing evidence link for ${place.id}`);

    target.verdict.evidenceLinks = ["not a URL"];
    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Invalid evidence link for ${place.id}: not a URL`);

    target.verdict.evidenceLinks = ["https://www.daiso.co.kr/cs/shop"];
    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES)).not.toThrow();
  });

  it("rejects a place whose source differs from the batch source", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.source = "kakao";

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Batch source kakao does not match ${place.id} source ados`);
  });

  it("rejects exact duplicate batches instead of duplicating their provenance", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    const base: HumanPlaceVerdictFile = { schemaVersion: 1, places: {} };
    const merged = mergePlaceAuditBatches(base, [parsed]);

    expect(Object.keys(merged.places)).toEqual([place.id]);
    expect(merged.places[place.id].identity).toBe("matched");
    expect(() => mergePlaceAuditBatches(base, [parsed, parsed]))
      .toThrow(`Duplicate place id across batches: ${place.id}`);
  });

  it("requires a correction to identify a repairable field and its canonical value", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.proposedAction = "correct";

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Correction for ${place.id} has no repairable field`);

    input.places[place.id].verdict.name = "differs";
    input.places[place.id].observed.nameKr = "";
    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing observed nameKr for correction: ${place.id}`);
  });

  it("requires both canonical coordinates when correcting a pin", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].verdict.proposedAction = "correct";
    input.places[place.id].verdict.pin = "mismatch";
    input.places[place.id].observed.latitude = 37.5;

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Missing observed coordinates for correction: ${place.id}`);
  });

  it.each([
    { field: "latitude", latitude: -90.01, longitude: 127 },
    { field: "latitude", latitude: 90.01, longitude: 127 },
    { field: "longitude", latitude: 37.5, longitude: -180.01 },
    { field: "longitude", latitude: 37.5, longitude: 180.01 },
  ])("rejects out-of-range observed $field", ({ field, latitude, longitude }) => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].observed.latitude = latitude;
    input.places[place.id].observed.longitude = longitude;

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Invalid observed.${field} for ${place.id}`);
  });

  it("requires observed coordinates to be both null or both numbers", () => {
    const input = validBatch() as PlaceAuditBatch;
    input.places[place.id].observed.latitude = 37.5;

    expect(() => parsePlaceAuditBatch(input, CATALOGUE_PLACES))
      .toThrow(`Observed coordinates must both be null or both numbers for ${place.id}`);
  });

  it("rejects a genuine conflict on a field already completed in the base file", () => {
    const parsed = parsePlaceAuditBatch(researchBatch("matched", "unchecked"), CATALOGUE_PLACES);
    const base = completedHuman({ identity: "matched" });

    expect(() => mergePlaceAuditBatches(base, [parsed]))
      .toThrow(`Completed base identity would be overwritten: ${place.id}`);
  });

  it("merges identity-only then Naver-English-only enrichment for one place", () => {
    const identity = parsePlaceAuditBatch(researchBatch("matched", "unchecked"), CATALOGUE_PLACES);
    const english = parsePlaceAuditBatch(researchBatch("unchecked", "matched"), CATALOGUE_PLACES);

    const merged = mergePlaceAuditBatches({ schemaVersion: 1, places: {} }, [identity, english]);
    expect(merged.places[place.id]).toMatchObject({
      identity: "matched",
      naverEnglish: "matched",
      naverPlaceId: NAVER_PLACE_ID,
    });
  });

  it("merges complementary batches deterministically regardless of input order", () => {
    const identityInput = researchBatch("matched", "unchecked") as PlaceAuditBatch;
    identityInput.reviewedAt = "2026-08-29";
    identityInput.places[place.id].verdict.reviewedAt = "2026-08-29";
    identityInput.places[place.id].verdict.reviewer = "Identity reviewer";
    identityInput.places[place.id].verdict.notes = "Identity evidence.";
    const englishInput = researchBatch("unchecked", "matched") as PlaceAuditBatch;
    englishInput.reviewedAt = "2026-08-31";
    englishInput.places[place.id].verdict.reviewedAt = "2026-08-31";
    englishInput.places[place.id].verdict.reviewer = "English-name reviewer";
    englishInput.places[place.id].verdict.notes = "English-name evidence.";
    const identity = parsePlaceAuditBatch(identityInput, CATALOGUE_PLACES);
    const english = parsePlaceAuditBatch(englishInput, CATALOGUE_PLACES);
    const base: HumanPlaceVerdictFile = { schemaVersion: 1, places: {} };

    const forward = mergePlaceAuditBatches(base, [identity, english]);
    const reverse = mergePlaceAuditBatches(base, [english, identity]);
    expect(forward).toEqual(reverse);
    expect(forward.places[place.id]).toMatchObject({
      proposedAction: "keep",
      reviewedAt: "2026-08-31",
      reviewer: "English-name reviewer; Identity reviewer",
      notes: [
        "[2026-08-29 — Identity reviewer] Identity evidence.",
        "[2026-08-31 — English-name reviewer] English-name evidence.",
      ].join("\n\n"),
    });
  });

  it("preserves both provenance records when either field starts in the base file", () => {
    const identityBase: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: {
        [place.id]: {
          identity: "matched",
          proposedAction: "keep",
          reviewedAt: "2026-08-29",
          reviewer: "Identity reviewer",
          notes: "Identity evidence.",
          evidenceLinks: [NAVER_DETAIL_URL],
          naverPlaceId: NAVER_PLACE_ID,
        },
      },
    };
    const englishBase: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: {
        [place.id]: {
          naverEnglish: "matched",
          proposedAction: "keep",
          reviewedAt: "2026-08-31",
          reviewer: "English-name reviewer",
          notes: "English-name evidence.",
          evidenceLinks: [NAVER_DETAIL_URL],
          naverPlaceId: NAVER_PLACE_ID,
        },
      },
    };
    const identityInput = researchBatch("matched", "unchecked") as PlaceAuditBatch;
    identityInput.reviewedAt = "2026-08-29";
    identityInput.places[place.id].verdict.reviewedAt = "2026-08-29";
    identityInput.places[place.id].verdict.reviewer = "Identity reviewer";
    identityInput.places[place.id].verdict.notes = "Identity evidence.";
    const englishInput = researchBatch("unchecked", "matched") as PlaceAuditBatch;
    englishInput.reviewedAt = "2026-08-31";
    englishInput.places[place.id].verdict.reviewedAt = "2026-08-31";
    englishInput.places[place.id].verdict.reviewer = "English-name reviewer";
    englishInput.places[place.id].verdict.notes = "English-name evidence.";
    const identity = parsePlaceAuditBatch(identityInput, CATALOGUE_PLACES);
    const english = parsePlaceAuditBatch(englishInput, CATALOGUE_PLACES);

    const identityThenEnglish = mergePlaceAuditBatches(identityBase, [english]);
    const englishThenIdentity = mergePlaceAuditBatches(englishBase, [identity]);
    expect(identityThenEnglish).toEqual(englishThenIdentity);
    expect(identityThenEnglish.places[place.id].reviewer).toContain("Identity reviewer");
    expect(identityThenEnglish.places[place.id].reviewer).toContain("English-name reviewer");
    expect(identityThenEnglish.places[place.id].notes).toContain("Identity evidence.");
    expect(identityThenEnglish.places[place.id].notes).toContain("English-name evidence.");
  });

  it("does not double-prefix provenance during a third complementary merge", () => {
    const identityInput = researchBatch("matched", "unchecked") as PlaceAuditBatch;
    identityInput.places[place.id].verdict.reviewer = "Identity reviewer";
    identityInput.places[place.id].verdict.notes = "Identity evidence.";
    const englishInput = researchBatch("unchecked", "matched") as PlaceAuditBatch;
    englishInput.places[place.id].verdict.reviewer = "English-name reviewer";
    englishInput.places[place.id].verdict.notes = "English-name evidence.";
    const nameInput = researchBatch("unchecked", "unchecked") as PlaceAuditBatch;
    nameInput.reviewedAt = "2026-09-01";
    nameInput.places[place.id].verdict.reviewedAt = "2026-09-01";
    nameInput.places[place.id].verdict.name = "matched";
    nameInput.places[place.id].verdict.reviewer = "Name reviewer";
    nameInput.places[place.id].verdict.notes = "Name evidence.";
    nameInput.places[place.id].verdict.evidenceLinks = ["https://www.daiso.co.kr/cs/shop"];
    nameInput.places[place.id].observed.naverPlaceId = null;

    const merged = mergePlaceAuditBatches({ schemaVersion: 1, places: {} }, [
      parsePlaceAuditBatch(identityInput, CATALOGUE_PLACES),
      parsePlaceAuditBatch(englishInput, CATALOGUE_PLACES),
      parsePlaceAuditBatch(nameInput, CATALOGUE_PLACES),
    ]).places[place.id];
    expect(merged.notes).not.toContain("[[");
    for (const note of ["Identity evidence.", "English-name evidence.", "Name evidence."]) {
      expect(merged.notes?.split(note)).toHaveLength(2);
    }
  });

  it("rejects a conflicting action during complementary enrichment", () => {
    const base = completedHuman({ identity: "matched" });
    const englishInput = researchBatch("unchecked", "matched") as PlaceAuditBatch;
    englishInput.places[place.id].verdict.proposedAction = "investigate";
    const english = parsePlaceAuditBatch(englishInput, CATALOGUE_PLACES);

    expect(() => mergePlaceAuditBatches(base, [english]))
      .toThrow(`Conflicting proposedAction for ${place.id}: keep vs investigate`);

    const identity = parsePlaceAuditBatch(researchBatch("matched", "unchecked"), CATALOGUE_PLACES);
    expect(() => mergePlaceAuditBatches({ schemaVersion: 1, places: {} }, [identity, english]))
      .toThrow(`Conflicting proposedAction for ${place.id}: keep vs investigate`);
    expect(() => mergePlaceAuditBatches({ schemaVersion: 1, places: {} }, [english, identity]))
      .toThrow(`Conflicting proposedAction for ${place.id}: investigate vs keep`);
  });

  it("merges Naver-English-only then identity-only enrichment for one place", () => {
    const englishBase = completedHuman({ naverEnglish: "matched" });
    const identity = parsePlaceAuditBatch(researchBatch("matched", "unchecked"), CATALOGUE_PLACES);

    expect(() => validatePlaceAuditBatchCoverage([identity], [place], englishBase)).not.toThrow();
    const merged = mergePlaceAuditBatches(englishBase, [identity]);
    expect(merged.places[place.id]).toMatchObject({
      identity: "matched",
      naverEnglish: "matched",
      naverPlaceId: NAVER_PLACE_ID,
    });
  });

  it("allows Naver-English-only enrichment when identity is already complete", () => {
    const identityBase = completedHuman({ identity: "matched" });
    const english = parsePlaceAuditBatch(researchBatch("unchecked", "matched"), CATALOGUE_PLACES);

    expect(() => validatePlaceAuditBatchCoverage([english], [place], identityBase)).not.toThrow();
    expect(mergePlaceAuditBatches(identityBase, [english]).places[place.id]).toMatchObject({
      identity: "matched",
      naverEnglish: "matched",
    });
  });

  it("preserves base-only support and media fields when adding research", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    const base: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: {
        [place.id]: {
          identity: "unchecked",
          englishSupport: "verified_yes",
          media: "licensed_photo",
        },
      },
    };

    const merged = mergePlaceAuditBatches(base, [parsed]);
    expect(merged.places[place.id]).toMatchObject({
      identity: "matched",
      englishSupport: "verified_yes",
      media: "licensed_photo",
    });
  });

  it("rejects malformed base verdict files at runtime", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);

    expect(() => mergePlaceAuditBatches(
      { schemaVersion: 1, places: null } as unknown as HumanPlaceVerdictFile,
      [parsed],
    )).toThrow("Base verdict places must be an object");
    expect(() => mergePlaceAuditBatches(
      { schemaVersion: 2, places: {} } as unknown as HumanPlaceVerdictFile,
      [parsed],
    )).toThrow("Unsupported place audit schema: 2");
  });

  it("enforces evidence completeness on direct verdict-file edits", () => {
    const valid = completedHuman({ identity: "matched" });
    expect(() => parseHumanPlaceVerdictFile(valid)).not.toThrow();

    for (const field of ["reviewedAt", "reviewer", "notes"] as const) {
      const input = structuredClone(valid) as HumanPlaceVerdictFile;
      delete input.places[place.id][field];
      expect(() => parseHumanPlaceVerdictFile(input)).toThrow(`Missing ${field} for ${place.id}`);
    }

    const searchOnly = structuredClone(valid) as HumanPlaceVerdictFile;
    searchOnly.places[place.id].evidenceLinks = ["https://map.naver.com/p/search/example"];
    expect(() => parseHumanPlaceVerdictFile(searchOnly))
      .toThrow(`Missing matching Naver place detail link for ${place.id}`);

    const missingId = structuredClone(valid) as HumanPlaceVerdictFile;
    delete missingId.places[place.id].naverPlaceId;
    expect(() => parseHumanPlaceVerdictFile(missingId))
      .toThrow(`Missing Naver place id for ${place.id}`);
  });

  it("requires evidence for direct field-only verdicts and permits an official HTTPS source", () => {
    const input: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: {
        [place.id]: {
          name: "matched",
          proposedAction: "keep",
          reviewedAt: "2026-08-30",
          reviewer: "Official-source reviewer",
          notes: "The official listing name was checked.",
          evidenceLinks: [],
        },
      },
    };
    expect(() => parseHumanPlaceVerdictFile(input))
      .toThrow(`Missing evidence link for ${place.id}`);

    input.places[place.id].evidenceLinks = ["https://www.daiso.co.kr/cs/shop"];
    expect(() => parseHumanPlaceVerdictFile(input)).not.toThrow();
  });

  it("accepts the committed human verdict file through the validated direct-edit path", () => {
    expect(() => parseHumanPlaceVerdictFile(humanVerdicts)).not.toThrow();
  });

  it("rejects empty or partial coverage of unchecked IDs for an included source", () => {
    const base: HumanPlaceVerdictFile = { schemaVersion: 1, places: {} };
    const partial = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    expect(() => validatePlaceAuditBatchCoverage(
      [partial],
      [place, secondPlace],
      base,
    )).toThrow(`Missing unchecked ados place ids from batches: ${secondPlace.id}`);

    const emptyInput = validBatch() as PlaceAuditBatch;
    emptyInput.places = {};
    const empty = parsePlaceAuditBatch(emptyInput, CATALOGUE_PLACES);
    expect(() => validatePlaceAuditBatchCoverage([empty], [place], base))
      .toThrow(`Missing unchecked ados place ids from batches: ${place.id}`);
  });

  it("accepts complete coverage while excluding completed base IDs", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    const base: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: {
        [secondPlace.id]: {
          identity: "not_found",
          name: "matched",
          address: "matched",
          pin: "exact",
          hours: "verified",
          naverEnglish: "not_found",
          reviewedAt: "2026-08-30",
          reviewer: "Independent Naver Map live review",
          notes: "All research fields were completed.",
          evidenceLinks: ["https://map.naver.com/p/search/not-found"],
        },
      },
    };

    expect(() => validatePlaceAuditBatchCoverage(
      [parsed],
      [place, secondPlace],
      base,
    )).not.toThrow();
  });

  it("rejects a batch row when every research field is already complete", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    const base = completedHuman({ identity: "matched", naverEnglish: "matched" });
    Object.assign(base.places[place.id], {
      name: "matched",
      address: "matched",
      pin: "exact",
      hours: "verified",
    });

    expect(() => validatePlaceAuditBatchCoverage([parsed], [place], base))
      .toThrow(`Batch includes non-unchecked ados place ids: ${place.id}`);
  });

  it("requires a batch for every source with unchecked catalogue rows", () => {
    const parsed = parsePlaceAuditBatch(validBatch(), CATALOGUE_PLACES);
    const base: HumanPlaceVerdictFile = { schemaVersion: 1, places: {} };

    expect(() => validatePlaceAuditBatchCoverage(
      [parsed],
      [place, otherSourcePlace],
      base,
    )).toThrow("Missing batch for unchecked source: curated");

    base.places[otherSourcePlace.id] = {
      identity: "not_found",
      name: "matched",
      address: "matched",
      pin: "exact",
      hours: "verified",
      naverEnglish: "not_found",
      reviewedAt: "2026-08-30",
      reviewer: "Independent Naver Map live review",
      notes: "All research fields were completed.",
      evidenceLinks: ["https://map.naver.com/p/search/not-found"],
    };
    expect(() => validatePlaceAuditBatchCoverage(
      [parsed],
      [place, otherSourcePlace],
      base,
    )).not.toThrow();
  });
});
