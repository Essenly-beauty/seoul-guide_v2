import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import hoursOverrides from "../scripts/lib/hours-overrides.json";
import { CATALOGUE_PLACES } from "./data";
import {
  buildAuditEntries,
  englishNameNeedsReview,
  providerSearchLinks,
  renderAuditMarkdown,
  summarizePlaceAudit,
  type HumanPlaceVerdictFile,
  type KakaoHoursEvidence,
} from "./place-audit";

const EMPTY_VERDICTS: HumanPlaceVerdictFile = { schemaVersion: 1, places: {} };
const KAKAO_HOURS = Object.fromEntries(
  Object.entries(hoursOverrides).map(([id, value]) => [id, {
    kakaoPlaceId: value.kakaoPlaceId,
    kakaoName: value.kakaoName,
    openDays: value.openDays,
  }]),
) as Record<string, KakaoHoursEvidence>;

describe("place launch audit", () => {
  it("represents every catalogue place exactly once without mutating PLACES", () => {
    const before = JSON.stringify(CATALOGUE_PLACES);
    const entries = buildAuditEntries(CATALOGUE_PLACES, EMPTY_VERDICTS, {});

    expect(entries).toHaveLength(CATALOGUE_PLACES.length);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(CATALOGUE_PLACES.length);
    expect(JSON.stringify(CATALOGUE_PLACES)).toBe(before);
  });

  it("builds encoded review links without fetching or copying provider content", () => {
    const links = providerSearchLinks({
      name: "Olive Young Myeongdong Town",
      nameKr: "올리브영 명동타운점",
      address: "서울 중구 명동길 53",
    });

    expect(links.google).toContain("google.com/maps/search/?api=1&query=");
    expect(links.naver).toContain("map.naver.com/p/search/");
    expect(decodeURIComponent(links.naverEnglish)).toBe("https://map.naver.com/p/search/Olive Young Myeongdong Town");
    expect(links.kakao).toContain("map.kakao.com/link/search/");
    expect(decodeURIComponent(links.google)).toContain("올리브영 명동타운점 서울 중구 명동길 53");
  });

  it("tracks English-name Naver discoverability separately from English service support", () => {
    const place = CATALOGUE_PLACES[0];
    const human: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: { [place.id]: { naverEnglish: "matched", englishSupport: "unknown" } },
    };
    const [entry] = buildAuditEntries([place], human, {});

    expect(entry.verdicts.naverEnglish).toBe("matched");
    expect(entry.verdicts.englishSupport).toBe("unknown");
  });

  it("flags promotional English titles that are unlikely to be canonical map names", () => {
    expect(englishNameNeedsReview("JUNO Hair Myeongdong | English-Speaking Stylist")).toBe(true);
    expect(englishNameNeedsReview("Olive Young Myeongdong Town")).toBe(false);
  });

  it("summarizes the current catalogue and committed Kakao evidence", () => {
    const entries = buildAuditEntries(CATALOGUE_PLACES, EMPTY_VERDICTS, KAKAO_HOURS);
    const summary = summarizePlaceAudit(entries);
    const expectedSourceCounts = Object.fromEntries(
      [...new Set(CATALOGUE_PLACES.map((place) => place.source ?? "unknown"))]
        .sort()
        .map((source) => [
          source,
          CATALOGUE_PLACES.filter((place) => (place.source ?? "unknown") === source).length,
        ]),
    );
    const coordinateCounts = new Map<string, number>();
    for (const place of CATALOGUE_PLACES) {
      const coordinate = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
      coordinateCounts.set(coordinate, (coordinateCounts.get(coordinate) ?? 0) + 1);
    }
    const expectedDuplicateCoordinates = CATALOGUE_PLACES.filter(
      (place) => (coordinateCounts.get(`${place.lat.toFixed(6)},${place.lng.toFixed(6)}`) ?? 0) > 1,
    ).length;

    expect(summary.total).toBe(CATALOGUE_PLACES.length);
    expect(summary.bySource).toEqual(expectedSourceCounts);
    expect(summary.bySource.daiso).toBe(251 + 33); // approved snapshot + 2026-09-18 shop-in-shop supplement
    expect(summary.findings.provisional_english_name).toBe(347 + 33); // + supplement Daiso names
    expect(summary.findings.approximate_pin).toBe(138 + 9); // + road-level supplement pins
    expect(summary.findings.outside_service_area).toBe(16);
    expect(summary.findings.no_licensed_photo).toBe(
      CATALOGUE_PLACES.filter((place) => !(place.photos?.length || place.photoUrl)).length,
    );
    expect(summary.findings.duplicate_coordinate).toBe(expectedDuplicateCoordinates);
    expect(summary.findings.missing_korean_listing_name).toBe(119);
    expect(summary.findings.generated_english_romanization).toBe(239);
    expect(summary.findings.cached_kakao_match).toBeGreaterThanOrEqual(350);
    expect(summary.byIdentity.matched).toBeUndefined();
    expect(summary.byIdentity.unchecked).toBe(CATALOGUE_PLACES.length);
    expect(summary.byAction.hide).toBe(15);
    expect(summary.byNaverEnglish.unchecked).toBe(CATALOGUE_PLACES.length);
  });

  it("derives provisional English-name findings from name verification, not English support", () => {
    const daisoPlace = CATALOGUE_PLACES.find((candidate) => candidate.source === "daiso")!;
    const entries = buildAuditEntries([
      { ...daisoPlace, englishOk: true, nameVerification: "provisional" },
      { ...daisoPlace, id: `${daisoPlace.id}-verified`, englishOk: false, nameVerification: "verified" },
    ], EMPTY_VERDICTS, {});
    const summary = summarizePlaceAudit(entries);

    expect(summary.findings.provisional_english_name).toBe(1);
    expect(entries[0].findings).toContain("provisional_english_name");
    expect(entries[1].findings).not.toContain("provisional_english_name");
  });

  it("does not treat cached Kakao hours as a verified identity match", () => {
    const [id] = Object.keys(KAKAO_HOURS);
    const place = CATALOGUE_PLACES.find((candidate) => candidate.id === id);
    expect(place).toBeDefined();

    const automatic = buildAuditEntries([place!], EMPTY_VERDICTS, KAKAO_HOURS);
    expect(automatic[0].verdicts.identity).toBe("unchecked");

    const human: HumanPlaceVerdictFile = {
      schemaVersion: 1,
      places: { [id]: { identity: "matched" } },
    };
    const overridden = buildAuditEntries([place!], human, KAKAO_HOURS);
    expect(overridden[0].verdicts.identity).toBe("matched");
  });

  it("renders a human review queue without treating unchecked as invalid", () => {
    const entries = buildAuditEntries(CATALOGUE_PLACES, EMPTY_VERDICTS, KAKAO_HOURS);
    const markdown = renderAuditMarkdown(entries, summarizePlaceAudit(entries));

    expect(markdown).toContain("# MYSEOULDROP place data audit");
    expect(markdown).toContain(`| Total places | ${CATALOGUE_PLACES.length} |`);
    expect(markdown).toContain("| Identity matched | 0 |");
    expect(markdown).toContain(`| Identity unchecked | ${CATALOGUE_PLACES.length} |`);
    expect(markdown).toContain("| Outside Seoul service area | 16 |");
    expect(markdown).toContain("| Provisional English place names | 380 |");
    expect(markdown).toContain("## Priority review queue");
    expect(markdown).toContain("| Naver English-name matched | 0 |");
    expect(markdown).toContain("| Place | Source | Identity | Naver EN | Action | Findings | Google | Naver (KO) | Naver (EN) | Kakao |");
    expect(markdown).toContain("approximate pin");
    expect(markdown).toContain("`unchecked` does not mean invalid");
  });

  it("rejects verdicts for unknown place ids", () => {
    expect(() => buildAuditEntries(CATALOGUE_PLACES, { schemaVersion: 1, places: { missing: {} } }, {}))
      .toThrow("Unknown place ids in verdicts: missing");
  });

  it("rejects verdict files from a different schema", () => {
    expect(() => buildAuditEntries(CATALOGUE_PLACES, { schemaVersion: 2 as 1, places: {} }, {}))
      .toThrow("Unsupported place audit schema: 2");
  });

  it("exposes deterministic write and check commands for the audit reports", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["audit:data"]).toBe("vite-node scripts/audit-places.ts");
    expect(pkg.scripts["audit:data:check"]).toBe("vite-node scripts/audit-places.ts --check");
    expect(pkg.scripts["verify:predeploy"]).toBe(
      "npm run typecheck && npm run lint && npm test && npm run audit:data:check && npm run build",
    );
  });

  it("documents the non-destructive operator workflow", () => {
    const checklist = readFileSync("docs/launch-checklist.md", "utf8");
    expect(checklist).toContain("npm run audit:data");
    expect(checklist).toContain("reports/place-audit.md");
    expect(checklist).toContain("unchecked does not mean invalid");
    expect(checklist).toContain("no automatic deletion");
    expect(checklist).toContain("내부 카탈로그는 995곳");
    expect(checklist).toContain("공개 카탈로그는 878곳");
    expect(checklist).toContain("nameVerification: provisional");
  });
});
