import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import top20Manifest from "../data/fixtures/daiso-ranking-top20-manifest.json";
import { DAISO_RANKING_DATA } from "./generated/daiso-ranking-products";
import {
  DAISO_CATEGORY_LABELS,
  categoriesForDaisoRank,
  selectDaisoRanking,
  selectDaisoRankingFromProducts,
  type DaisoRankKey,
} from "./daiso-ranking";

const RANK_KEYS: readonly DaisoRankKey[] = ["rising", "daily", "weekly"];
const SOURCE_SHA256 = "29b8d65c64db6fe95d0ca9ce2f6a2428732185121608b8d314c8d15a32b32bcc";
const TOP20_MANIFEST_SHA256 = "e67de59d3a737203d6e13227d4219583e49ebf591a97b72228a5e38289fc575e";

function canonicalVisibleProducts() {
  return DAISO_RANKING_DATA.products
    .map((product) => {
      const ranks = product.ranks as Partial<Record<DaisoRankKey, number>>;
      return {
        retailer: product.retailer,
        id: product.id,
        productNo: product.productNo,
        nameKr: product.nameKr,
        brand: product.brand,
        categoryKr: product.categoryKr,
        subcategoryKr: product.subcategoryKr,
        priceWon: product.priceWon,
        rating: product.rating,
        reviewCountText: product.reviewCountText,
        productUrl: product.productUrl,
        collectedAt: product.collectedAt,
        ranks: {
          rising: ranks.rising ?? null,
          daily: ranks.daily ?? null,
          weekly: ranks.weekly ?? null,
        },
        delivery: {
          parcel: product.delivery.parcel,
          pickup: product.delivery.pickup,
          sameDay: product.delivery.sameDay,
        },
      };
    })
    .sort((left, right) => left.productNo.localeCompare(
      right.productNo,
      "en",
      { numeric: true },
    ));
}

describe("generated Daiso ranking data", () => {
  it("pins the approved source metadata and 38-product TOP20 union", () => {
    expect(DAISO_RANKING_DATA.source).toEqual(expect.objectContaining({
      sha256: SOURCE_SHA256,
      rowCount: 3046,
      collectedAt: "2026-08-31",
      seller: "다이소몰",
    }));
    expect(DAISO_RANKING_DATA.products).toHaveLength(38);
    expect(new Set(DAISO_RANKING_DATA.products.map((product) => product.productNo))).toHaveLength(38);
  });

  it("keeps the metadata JSON and generated source constants consistent", () => {
    const metadata = JSON.parse(readFileSync(
      resolve("data/sources/daiso-ranking-2026-08-31.meta.json"),
      "utf8",
    ));

    expect(DAISO_RANKING_DATA.source).toEqual(metadata);
  });

  it("contains only Daiso runtime facts without invented cross-retailer fields", () => {
    const forbiddenFields = [
      "imageUrl",
      "nameEn",
      "nameKo",
      "skinTypes",
      "skinConcerns",
      "channel",
      "salesRank",
      "reviewRank",
    ];

    for (const product of DAISO_RANKING_DATA.products) {
      expect(product.retailer).toBe("daiso");
      expect(product.id).toBe(`daiso:${product.productNo}`);
      expect(product.collectedAt).toBe("2026-08-31");
      expect(forbiddenFields.filter((field) => field in product)).toEqual([]);
      expect(Number.isInteger(product.priceWon)).toBe(true);
      expect(product.priceWon).toBeGreaterThanOrEqual(500);
      expect(product.priceWon).toBeLessThanOrEqual(5000);
      expect(product.rating === null || (product.rating >= 0 && product.rating <= 5)).toBe(true);
      expect(product.reviewCountText === null || typeof product.reviewCountText === "string").toBe(true);
      expect(product.delivery).toEqual({
        parcel: expect.any(Boolean),
        pickup: expect.any(Boolean),
        sameDay: expect.any(Boolean),
      });

      const url = new URL(product.productUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("www.daisomall.co.kr");
      expect(url.searchParams.getAll("pdNo")).toEqual([product.productNo]);
    }
    expect(DAISO_RANKING_DATA.products.some((product) => product.reviewCountText === "9,999+")).toBe(true);
  });
});

describe("Daiso TOP20 selectors", () => {
  it("pins every user-visible field for the complete 38-product union", () => {
    const canonicalJson = JSON.stringify(canonicalVisibleProducts());

    expect(canonicalVisibleProducts()).toHaveLength(38);
    expect(createHash("sha256").update(canonicalJson).digest("hex")).toBe(
      top20Manifest.productsCanonicalSha256,
    );
    expect(top20Manifest.productsCanonicalSha256).toBe(
      "64ff5d399d41c2b0fd9a4984d207ab70b516101294ab221ce729cb2439d8d975",
    );
  });

  it("matches the independently pinned ordered TOP20 manifest", () => {
    const manifestText = readFileSync(
      resolve("data/fixtures/daiso-ranking-top20-manifest.json"),
      "utf8",
    );
    expect(createHash("sha256").update(manifestText).digest("hex")).toBe(TOP20_MANIFEST_SHA256);
    expect(top20Manifest.sourceSha256).toBe(SOURCE_SHA256);

    for (const rankKey of RANK_KEYS) {
      expect(selectDaisoRanking(rankKey).map(({ product, rank }) => ({
        productNo: product.productNo,
        rank,
      }))).toEqual(top20Manifest.lists[rankKey]);
    }
  });

  it.each(RANK_KEYS)("returns exactly source ranks 1 through 20 for %s", (rankKey) => {
    const rows = selectDaisoRanking(rankKey);

    expect(rows).toHaveLength(20);
    expect(rows.map((row) => row.rank)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(new Set(rows.map((row) => row.product.productNo)).size).toBe(20);
  });

  it("does not leak another tab's ranks 21 through 50 from the generated union", () => {
    for (const rankKey of RANK_KEYS) {
      expect(selectDaisoRanking(rankKey).every(({ rank }) => rank >= 1 && rank <= 20)).toBe(true);
    }
  });

  it.each(RANK_KEYS)("offers only categories present in the unfiltered %s TOP20", (rankKey) => {
    const rows = selectDaisoRanking(rankKey);
    const present = new Set(rows.map(({ product }) => product.categoryKr));
    const options = categoriesForDaisoRank(rankKey);

    expect(options[0]).toEqual({ key: "all", label: "All" });
    expect(options.slice(1).map(({ key }) => key)).toEqual(
      Object.keys(DAISO_CATEGORY_LABELS).filter((categoryKr) => present.has(categoryKr)),
    );
    expect(options.slice(1).every(({ key }) => present.has(key))).toBe(true);
  });

  it("defines the complete bilingual category label contract with hygiene categories last", () => {
    expect(DAISO_CATEGORY_LABELS).toEqual({
      스킨케어: "Skincare",
      마스크팩: "Masks",
      클렌징: "Cleansing",
      선케어: "Sun Care",
      메이크업: "Makeup",
      네일: "Nail",
      뷰티소품: "Beauty Tools",
      헤어케어: "Hair Care",
      바디케어: "Body Care",
      맨즈케어: "Men's Care",
      향수: "Fragrance",
      "뷰티/위생": "Beauty & Hygiene",
      위생용품: "Hygiene",
    });
  });

  it("has a display label for every category used by any published TOP20 row", () => {
    const publishedCategories = new Set(
      RANK_KEYS.flatMap((rankKey) =>
        selectDaisoRanking(rankKey).map(({ product }) => product.categoryKr),
      ),
    );

    expect([...publishedCategories].filter(
      (categoryKr) => !(categoryKr in DAISO_CATEGORY_LABELS),
    )).toEqual([]);
  });

  it("filters after sorting so weekly Makeup keeps its original source-rank gap", () => {
    const rows = selectDaisoRanking("weekly", "메이크업");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].rank).toBe(12);
    expect(rows.map(({ rank }) => rank)).not.toEqual(
      Array.from({ length: rows.length }, (_, index) => index + 1),
    );
    expect(rows.every(({ product }) => product.categoryKr === "메이크업")).toBe(true);
  });

  it("returns an empty list for an unavailable category without substituting another retailer", () => {
    expect(selectDaisoRanking("daily", "존재하지 않는 분류")).toEqual([]);
  });

  it("honors an explicitly injected empty dataset without falling back to generated products", () => {
    expect(selectDaisoRankingFromProducts([], "daily", "all")).toEqual([]);
  });
});
