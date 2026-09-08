import { describe, expect, it } from "vitest";

import { englishizeDaisoName } from "./english-place-name";

describe("englishizeDaisoName", () => {
  it("generates a deterministic English display name for a station branch", () => {
    expect(englishizeDaisoName("다이소 강남역점")).toBe("Daiso Gangnam Stn.");
  });

  it("removes the main-branch suffix and leaves no Hangul in the display name", () => {
    const name = englishizeDaisoName("다이소 명동본점");

    expect(name).toBe("Daiso Myeongdong");
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
