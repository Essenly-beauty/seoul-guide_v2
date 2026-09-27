import { describe, expect, it } from "vitest";

import { englishizeDaisoName } from "./english-place-name";

describe("englishizeDaisoName", () => {
  it("generates a deterministic English display name for a station branch", () => {
    expect(englishizeDaisoName("다이소 강남역점")).toBe("Daiso Gangnam Stn.");
  });

  it("marks the main branch and leaves no Hangul in the display name", () => {
    // Used to assert "Daiso Myeongdong": the 본점 marker was being deleted, so
    // the main branch was indistinguishable from any other 명동 store.
    const name = englishizeDaisoName("다이소 명동본점");

    expect(name).toBe("Daiso Myeongdong Main");
    expect(name).not.toMatch(/[가-힣]/u);
  });

  it("normalizes decomposed Hangul before generating the display name", () => {
    const decomposed = "다이소 강남역점".normalize("NFD");

    expect(englishizeDaisoName(decomposed)).toBe("Daiso Gangnam Stn.");
  });

  it("returns the brand without trailing whitespace when no branch name exists", () => {
    expect(englishizeDaisoName("다이소")).toBe("Daiso");
  });

  it.each([
    ["다이소 강남역", "Daiso Gangnam Stn."],
    ["다이소 강남구청점", "Daiso Gangnam-gu Office"],
    ["다이소 강남타운", "Daiso Gangnam Town"],
    ["다이소 강남거리점", "Daiso Gangnam St."],
    ["다이소 강남점", "Daiso Gangnam"],
  ])("maps the branch suffix in %s", (nameKr, expected) => {
    expect(englishizeDaisoName(nameKr)).toBe(expected);
  });
});

/** Two suffix-table bugs found while correcting the retail branch names
 *  (docs/research/retail-branch-names-2026-09.md §2). They do not change any
 *  shipped name on their own — the generated modules hold today's strings —
 *  but they would re-introduce both defects the moment a pipeline reruns. */
describe("branch suffix handling", () => {
  it("keeps the main-branch marker instead of deleting it", () => {
    // ["본점", ""] silently dropped the one thing that distinguishes 노원본점
    // from 노원점, and left Olive Young rows ending in a dangling "bon".
    expect(englishizeDaisoName("노원본점")).toBe("Daiso Nowon Main");
    expect(englishizeDaisoName("봉천본점")).toBe("Daiso Bongcheon Main");
  });

  it("does not invent a street out of an intersection", () => {
    // ["거리점", " St."] matched the last three characters of 사거리점, so all
    // 25 intersections became streets that do not exist ("미아사거리점" read as
    // "Daiso Miasa St."). This rule is the fallback, not the final name: where
    // the intersection is itself a station name — 미아사거리, 신정네거리 — the
    // verified name in scripts/lib/en-name-overrides.json keeps it whole.
    for (const [kr, en] of [
      ["미아사거리점", "Daiso Mia Intersection"],
      ["신대방삼거리점", "Daiso Sindaebang Intersection"],
      ["신정네거리점", "Daiso Sinjeong Intersection"],
      ["강북구청사거리점", "Daiso Gangbukgucheong Intersection"],
    ] as const) {
      expect(englishizeDaisoName(kr)).toBe(en);
      expect(englishizeDaisoName(kr)).not.toMatch(/ St\.$/);
    }
  });

  it("still calls a real street a street", () => {
    expect(englishizeDaisoName("녹두거리점")).toBe("Daiso Nokdu St.");
  });

  it("still handles a real street and the suffixes that already worked", () => {
    expect(englishizeDaisoName("강남역점")).toBe("Daiso Gangnam Stn.");
    expect(englishizeDaisoName("개포동점")).toBe("Daiso Gaepodong");
  });
});
