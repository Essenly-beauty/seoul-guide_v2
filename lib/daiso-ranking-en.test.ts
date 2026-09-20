import { describe, expect, it } from "vitest";
import { DAISO_RANKING_DATA } from "./generated/daiso-ranking-products";
import { DAISO_SUBCATEGORY_LABELS, daisoBrandEn, daisoNameEn, daisoSubcategoryEn } from "./daiso-ranking-en";

const products = DAISO_RANKING_DATA.products;
const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** The Daiso ranking is read by foreign tourists who cannot read Korean, but
 *  every product rendered its Korean name, a mis-parsed Korean "brand" and a
 *  Korean subcategory. English names were verified one product at a time
 *  against daisomall.co.kr on 2026-09-20 and live in
 *  scripts/lib/daiso-ranking-en-overrides.json, because the generated module
 *  is rebuilt from a SHA-pinned CSV and must never be hand-edited. */
describe("Daiso ranking English names", () => {
  it("covers every product in the shipped ranking", () => {
    for (const p of products) {
      expect(daisoNameEn(p.productNo), `${p.productNo} ${p.nameKr}`).toBeTruthy();
      expect(daisoBrandEn(p.productNo), `${p.productNo} brand`).toBeTruthy();
    }
  });

  it("shows no Korean in any English name or brand", () => {
    for (const p of products) {
      expect(HANGUL.test(daisoNameEn(p.productNo)), `${p.productNo} name`).toBe(false);
      expect(HANGUL.test(daisoBrandEn(p.productNo)), `${p.productNo} brand`).toBe(false);
    }
  });

  it("notices when a rebuild changes a Korean name the English was verified against", () => {
    // Each override records the nameKr it was checked against. If the CSV is
    // re-imported and a name moves, the English is no longer known-good and
    // this fails rather than shipping a stale translation.
    for (const p of products) {
      expect(daisoNameEn(p.productNo, { requireFreshFor: p.nameKr }), `${p.productNo} drift`).toBeTruthy();
    }
  });

  it("strips the Korean promotional brackets from the displayed name", () => {
    // e.g. "[퀵 수분충전]VT PDRN 광채 토너 200 ml" — a campaign tag, not a name
    const bracketed = products.filter((p) => p.nameKr.startsWith("["));
    expect(bracketed.length).toBeGreaterThan(0);
    for (const p of bracketed) expect(daisoNameEn(p.productNo)).not.toContain("[");
  });

  it("corrects the brand column where the CSV captured the first word instead", () => {
    // "두꺼운" (thick), "삼각" (triangle), "엠보싱" (embossing) are not brands
    expect(daisoBrandEn("1043552")).toBe("Daiso");
    expect(daisoBrandEn("90196")).toBe("Daiso");
    expect(daisoBrandEn("1061529")).toBe("Real Barrier");
    expect(daisoBrandEn("1083568")).toBe("Nature Republic");
  });

  it("translates every subcategory the ranking can render", () => {
    for (const p of products) {
      const en = daisoSubcategoryEn(p.subcategoryKr);
      expect(en, p.subcategoryKr).toBeTruthy();
      expect(HANGUL.test(en), `${p.subcategoryKr} -> ${en}`).toBe(false);
    }
    expect(Object.keys(DAISO_SUBCATEGORY_LABELS).length).toBeGreaterThanOrEqual(8);
  });

  it("falls back to the Korean name for an unknown product rather than throwing", () => {
    expect(daisoNameEn("does-not-exist")).toBe("");
    expect(daisoSubcategoryEn("알수없음")).toBe("알수없음");
  });
});
