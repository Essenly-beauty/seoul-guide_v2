import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDaisoRankingDataset,
  parseDaisoRankingCsv,
} from "./daiso-ranking-import";
import {
  rankingInputFromCli,
  runDaisoRankingBuild,
  writeTextAtomically,
} from "../scripts/build-daiso-ranking";

const HEADER = [
  "에센리 제품코드",
  "다이소 상품번호",
  "공식 제품명",
  "공식 영문명",
  "브랜드",
  "옵션/색상",
  "대분류",
  "세부분류",
  "가격(원)",
  "용량/수량",
  "키워드",
  "상품 링크",
  "판매처",
  "추천/신상품",
  "랭킹 필터",
  "급상승 순위",
  "일간 순위",
  "주간 순위",
  "평점",
  "리뷰수",
  "택배배송",
  "매장픽업",
  "오늘배송",
  "수집일",
].join(",");

const COMPACT_CSV = `${HEADER}\nD000001,1001264,해서린 스팟 케어패치 붉은 스팟,,해서린,,스킨케어,마스크팩/패치,1000,,"스킨케어, 마스크팩/패치",https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=1001264,다이소몰,,뷰티/위생,50,,,4.8,"1,810",Y,Y,Y,2026-08-31\nD000002,1001594,"리빙 ""소프트팩"" 티슈 150매X3입",,리빙,,위생용품,생활위생,2000,150매,"위생용품, 생활위생",https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=1001594,다이소몰,,뷰티/위생,43,,,4.9,"9,999+",Y,,Y,2026-08-31\n`;

type MutableRow = ReturnType<typeof parseDaisoRankingCsv>[number];

function validRows(): MutableRow[] {
  return Array.from({ length: 3046 }, (_, index) => {
    const productNo = String(1_000_000 + index);
    const rankAt = (start: number) => {
      const rank = index - start + 1;
      return rank >= 1 && rank <= 50 ? rank : null;
    };
    return {
      sourceCode: `D${String(index + 1).padStart(6, "0")}`,
      productNo,
      nameKr: `상품 ${index + 1}`,
      brand: `브랜드 ${index % 11}`,
      categoryKr: `대분류 ${index % 13}`,
      subcategoryKr: `세부분류 ${index % 14}`,
      priceWon: 1_000 + index,
      productUrl: `https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=${productNo}`,
      seller: "다이소몰",
      rating: index % 17 === 0 ? null : 4.8,
      reviewCountText: index === 0 ? "9,999+" : "1,810",
      delivery: { parcel: true, pickup: index % 2 === 0, sameDay: true },
      collectedAt: "2026-08-31",
      ranks: {
        rising: rankAt(0),
        daily: rankAt(10),
        weekly: rankAt(18),
      },
    };
  });
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("parseDaisoRankingCsv", () => {
  it("parses quoted commas and escaped quotes while preserving review display text", () => {
    const rows = parseDaisoRankingCsv(COMPACT_CSV);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(expect.objectContaining({
      productNo: "1001264",
      priceWon: 1000,
      rating: 4.8,
      reviewCountText: "1,810",
    }));
    expect(rows[1]).toEqual(expect.objectContaining({
      nameKr: '리빙 "소프트팩" 티슈 150매X3입',
      reviewCountText: "9,999+",
    }));
    expect(rows[1].delivery).toEqual({ parcel: true, pickup: false, sameDay: true });
  });

  it("rejects a CSV with a required header missing", () => {
    const withoutReviewHeader = COMPACT_CSV.replace(",리뷰수,", ",누락된리뷰수,");
    expect(() => parseDaisoRankingCsv(withoutReviewHeader)).toThrow(/리뷰수/);
  });
});

describe("buildDaisoRankingDataset", () => {
  it("validates all 3,046 rows before selecting and merges TOP20 memberships into 38 products", () => {
    const rows = validRows();
    const dataset = buildDaisoRankingDataset(rows, "a".repeat(64));

    expect(dataset.source.rowCount).toBe(3046);
    expect(dataset.products).toHaveLength(38);
    expect(dataset.products[18].ranks).toEqual({ rising: 19, daily: 9, weekly: 1 });
    expect(dataset.products[0].reviewCountText).toBe("9,999+");
  });

  it("rejects duplicate product numbers even outside TOP20", () => {
    const rows = validRows();
    rows[3045] = { ...rows[3045], productNo: rows[3044].productNo };
    expect(() => buildDaisoRankingDataset(rows, "a".repeat(64))).toThrow(/duplicate.*product/i);
  });

  it.each([
    ["seller", (rows: MutableRow[]) => { rows[3045] = { ...rows[3045], seller: "외부몰" }; }, /seller/i],
    ["domain", (rows: MutableRow[]) => { rows[3045] = { ...rows[3045], productUrl: `https://example.com/?pdNo=${rows[3045].productNo}` }; }, /domain|Daiso Mall/i],
    ["pdNo", (rows: MutableRow[]) => { rows[3045] = { ...rows[3045], productUrl: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=wrong" }; }, /pdNo/i],
    ["date", (rows: MutableRow[]) => { rows[3045] = { ...rows[3045], collectedAt: "2026-08-30" }; }, /date|2026-08-31/i],
  ])("rejects an invalid %s on a non-TOP20 row", (_label, mutate, message) => {
    const rows = validRows();
    mutate(rows);
    expect(() => buildDaisoRankingDataset(rows, "a".repeat(64))).toThrow(message);
  });

  it("rejects a duplicate rank", () => {
    const rows = validRows();
    rows[1] = { ...rows[1], ranks: { ...rows[1].ranks, rising: 1 } };
    expect(() => buildDaisoRankingDataset(rows, "a".repeat(64))).toThrow(/rising.*duplicate/i);
  });

  it("rejects a missing rank", () => {
    const rows = validRows();
    rows[49] = { ...rows[49], ranks: { ...rows[49].ranks, rising: null } };
    expect(() => buildDaisoRankingDataset(rows, "a".repeat(64))).toThrow(/rising.*1.*50/i);
  });

  it("rejects an unexpected source row count before selecting TOP20", () => {
    expect(() => buildDaisoRankingDataset(validRows().slice(0, -1), "a".repeat(64))).toThrow(/3,?046/);
  });
});

describe("runDaisoRankingBuild", () => {
  it("requires the approved SHA and preserves the previous output on failure", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-ranking-build-"));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, "ranking.csv");
    const outputPath = join(directory, "generated.ts");
    await writeFile(inputPath, COMPACT_CSV, "utf8");
    await writeFile(outputPath, "last known good\n", "utf8");

    await expect(runDaisoRankingBuild({ inputPath, outputPath })).rejects.toThrow(/SHA-256/);
    await expect(readFile(outputPath, "utf8")).resolves.toBe("last known good\n");
  });

  it("uses a unique temporary file for concurrent atomic writes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "daiso-ranking-build-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "generated.ts");
    vi.spyOn(Date, "now").mockReturnValue(1_799_999_999_999);

    await expect(Promise.all([
      writeTextAtomically(outputPath, "first complete output\n"),
      writeTextAtomically(outputPath, "second complete output\n"),
    ])).resolves.toEqual([undefined, undefined]);
    await expect(readFile(outputPath, "utf8")).resolves.toMatch(/^(first|second) complete output\n$/);
  });
});

describe("rankingInputFromCli", () => {
  it("prefers an explicit argument and supports the approved environment fallback", () => {
    expect(rankingInputFromCli(["--input", "/tmp/explicit.csv"], {
      DAISO_RANKING_INPUT: "/tmp/environment.csv",
    })).toBe("/tmp/explicit.csv");
    expect(rankingInputFromCli([], {
      DAISO_RANKING_INPUT: "/tmp/environment.csv",
    })).toBe("/tmp/environment.csv");
  });

  it("rejects missing input instead of depending on a local Downloads path", () => {
    expect(() => rankingInputFromCli([], {})).toThrow(/--input.*DAISO_RANKING_INPUT/);
  });
});
