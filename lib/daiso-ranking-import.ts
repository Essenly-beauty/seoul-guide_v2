export const DAISO_RANKING_SOURCE = {
  sourceFile: "화장품 제품정보 + 출처링크 병합본 - 다이소 제품 정보.csv",
  sha256: "29b8d65c64db6fe95d0ca9ce2f6a2428732185121608b8d314c8d15a32b32bcc",
  rowCount: 3046,
  collectedAt: "2026-08-31",
  seller: "다이소몰",
} as const;

export type DaisoCsvRankKey = "rising" | "daily" | "weekly";

export type DaisoCsvRow = {
  sourceCode: string;
  productNo: string;
  nameKr: string;
  brand: string;
  categoryKr: string;
  subcategoryKr: string;
  priceWon: number;
  productUrl: string;
  seller: string;
  rating: number | null;
  reviewCountText: string | null;
  delivery: { parcel: boolean; pickup: boolean; sameDay: boolean };
  collectedAt: string;
  ranks: Record<DaisoCsvRankKey, number | null>;
};

export type DaisoGeneratedRankingProduct = {
  retailer: "daiso";
  id: `daiso:${string}`;
  productNo: string;
  nameKr: string;
  brand: string;
  categoryKr: string;
  subcategoryKr: string;
  priceWon: number;
  rating: number | null;
  reviewCountText: string | null;
  productUrl: string;
  collectedAt: "2026-08-31";
  ranks: Partial<Record<DaisoCsvRankKey, number>>;
  delivery: { parcel: boolean; pickup: boolean; sameDay: boolean };
};

export type DaisoRankingDataset = {
  source: {
    sourceFile: typeof DAISO_RANKING_SOURCE.sourceFile;
    sha256: string;
    rowCount: typeof DAISO_RANKING_SOURCE.rowCount;
    collectedAt: typeof DAISO_RANKING_SOURCE.collectedAt;
    seller: typeof DAISO_RANKING_SOURCE.seller;
  };
  products: DaisoGeneratedRankingProduct[];
};

const REQUIRED_HEADERS = [
  "에센리 제품코드",
  "다이소 상품번호",
  "공식 제품명",
  "브랜드",
  "대분류",
  "세부분류",
  "가격(원)",
  "상품 링크",
  "판매처",
  "급상승 순위",
  "일간 순위",
  "주간 순위",
  "평점",
  "리뷰수",
  "택배배송",
  "매장픽업",
  "오늘배송",
  "수집일",
] as const;

const RANK_LABELS: Record<DaisoCsvRankKey, string> = {
  rising: "급상승 순위",
  daily: "일간 순위",
  weekly: "주간 순위",
};

function normalizeCell(value: string): string {
  return value.normalize("NFKC").trim();
}

function parseCsvRecords(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  const finishField = () => {
    record.push(field);
    field = "";
    afterQuote = false;
  };
  const finishRecord = () => {
    finishField();
    if (record.some((value) => value.length > 0)) records.push(record);
    record = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote && character !== "," && character !== "\n" && character !== "\r") {
      if (/\s/.test(character)) continue;
      throw new Error(`Unexpected character after closing CSV quote at offset ${index}`);
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      finishField();
    } else if (character === "\n") {
      finishRecord();
    } else if (character === "\r") {
      if (source[index + 1] === "\n") index += 1;
      finishRecord();
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("Unterminated quoted CSV field");
  if (field.length > 0 || record.length > 0) finishRecord();
  return records;
}

function parseRequiredNumber(value: string, label: string, rowNumber: number): number {
  const normalized = normalizeCell(value).replace(/,/g, "");
  const parsed = Number(normalized);
  if (!normalized || !Number.isFinite(parsed)) throw new Error(`Row ${rowNumber} ${label} must be numeric`);
  return parsed;
}

function parseOptionalNumber(value: string, label: string, rowNumber: number): number | null {
  const normalized = normalizeCell(value).replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Row ${rowNumber} ${label} must be numeric or blank`);
  return parsed;
}

function parseDelivery(value: string, label: string, rowNumber: number): boolean {
  const normalized = normalizeCell(value).toUpperCase();
  if (!normalized || normalized === "N") return false;
  if (normalized === "Y") return true;
  throw new Error(`Row ${rowNumber} ${label} must be Y, N, or blank`);
}

function requireCell(value: string, label: string, rowNumber: number): string {
  const normalized = normalizeCell(value);
  if (!normalized) throw new Error(`Row ${rowNumber} ${label} must not be blank`);
  return normalized;
}

export function parseDaisoRankingCsv(text: string): DaisoCsvRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) throw new Error("Daiso ranking CSV is empty");

  const headers = records[0].map(normalizeCell);
  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) throw new Error(`Daiso ranking CSV is missing required header: ${header}`);
  }
  if (new Set(headers).size !== headers.length) throw new Error("Daiso ranking CSV contains duplicate headers");

  const column = new Map(headers.map((header, index) => [header, index]));
  const cell = (record: string[], header: string) => record[column.get(header)!] ?? "";

  return records.slice(1).map((record, index) => {
    const rowNumber = index + 2;
    if (record.length !== headers.length) {
      throw new Error(`Row ${rowNumber} has ${record.length} columns; expected ${headers.length}`);
    }
    return {
      sourceCode: requireCell(cell(record, "에센리 제품코드"), "에센리 제품코드", rowNumber),
      productNo: requireCell(cell(record, "다이소 상품번호"), "다이소 상품번호", rowNumber),
      nameKr: requireCell(cell(record, "공식 제품명"), "공식 제품명", rowNumber),
      brand: normalizeCell(cell(record, "브랜드")),
      categoryKr: requireCell(cell(record, "대분류"), "대분류", rowNumber),
      subcategoryKr: requireCell(cell(record, "세부분류"), "세부분류", rowNumber),
      priceWon: parseRequiredNumber(cell(record, "가격(원)"), "가격(원)", rowNumber),
      productUrl: requireCell(cell(record, "상품 링크"), "상품 링크", rowNumber),
      seller: requireCell(cell(record, "판매처"), "판매처", rowNumber),
      rating: parseOptionalNumber(cell(record, "평점"), "평점", rowNumber),
      reviewCountText: normalizeCell(cell(record, "리뷰수")) || null,
      delivery: {
        parcel: parseDelivery(cell(record, "택배배송"), "택배배송", rowNumber),
        pickup: parseDelivery(cell(record, "매장픽업"), "매장픽업", rowNumber),
        sameDay: parseDelivery(cell(record, "오늘배송"), "오늘배송", rowNumber),
      },
      collectedAt: requireCell(cell(record, "수집일"), "수집일", rowNumber),
      ranks: {
        rising: parseOptionalNumber(cell(record, "급상승 순위"), "급상승 순위", rowNumber),
        daily: parseOptionalNumber(cell(record, "일간 순위"), "일간 순위", rowNumber),
        weekly: parseOptionalNumber(cell(record, "주간 순위"), "주간 순위", rowNumber),
      },
    };
  });
}

function validateUrl(row: DaisoCsvRow, rowNumber: number): void {
  let url: URL;
  try {
    url = new URL(row.productUrl);
  } catch {
    throw new Error(`Row ${rowNumber} product URL must be a valid Daiso Mall URL`);
  }
  if (url.protocol !== "https:" || url.hostname !== "www.daisomall.co.kr") {
    throw new Error(`Row ${rowNumber} product URL domain must be www.daisomall.co.kr over HTTPS`);
  }
  const productNumbers = url.searchParams.getAll("pdNo");
  if (productNumbers.length !== 1 || productNumbers[0] !== row.productNo) {
    throw new Error(`Row ${rowNumber} product URL pdNo must equal productNo ${row.productNo}`);
  }
}

function validateRanks(rows: readonly DaisoCsvRow[], key: DaisoCsvRankKey): void {
  const values = rows.flatMap((row) => row.ranks[key] === null ? [] : [row.ranks[key] as number]);
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 50)) {
    throw new Error(`${key} ranks must be integers from 1 through 50`);
  }
  if (new Set(values).size !== values.length) throw new Error(`${key} ranks contain a duplicate`);
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length !== 50 || sorted.some((value, index) => value !== index + 1)) {
    throw new Error(`${key} ranks must contain every rank from 1 through 50 exactly once`);
  }
}

export function buildDaisoRankingDataset(
  rows: readonly DaisoCsvRow[],
  sourceSha256: string,
): DaisoRankingDataset {
  if (rows.length !== DAISO_RANKING_SOURCE.rowCount) {
    throw new Error(`Daiso ranking source must contain exactly 3,046 rows; received ${rows.length}`);
  }
  if (!/^[a-f\d]{64}$/i.test(sourceSha256)) throw new Error("Daiso ranking source SHA-256 must be 64 hexadecimal characters");

  const productNumbers = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (productNumbers.has(row.productNo)) throw new Error(`Row ${rowNumber} has duplicate product number ${row.productNo}`);
    productNumbers.add(row.productNo);
    if (row.seller !== DAISO_RANKING_SOURCE.seller) throw new Error(`Row ${rowNumber} seller must be ${DAISO_RANKING_SOURCE.seller}`);
    if (row.collectedAt !== DAISO_RANKING_SOURCE.collectedAt) {
      throw new Error(`Row ${rowNumber} collection date must be ${DAISO_RANKING_SOURCE.collectedAt}`);
    }
    if (!Number.isInteger(row.priceWon) || row.priceWon < 0) throw new Error(`Row ${rowNumber} price must be a non-negative integer`);
    if (row.rating !== null && (!Number.isFinite(row.rating) || row.rating < 0 || row.rating > 5)) {
      throw new Error(`Row ${rowNumber} rating must be between 0 and 5 or blank`);
    }
    validateUrl(row, rowNumber);
  });

  for (const key of Object.keys(RANK_LABELS) as DaisoCsvRankKey[]) validateRanks(rows, key);

  const products = rows.filter((row) =>
    (Object.values(row.ranks) as Array<number | null>).some((rank) => rank !== null && rank <= 20),
  ).map((row): DaisoGeneratedRankingProduct => {
    const ranks: Partial<Record<DaisoCsvRankKey, number>> = {};
    for (const key of Object.keys(RANK_LABELS) as DaisoCsvRankKey[]) {
      if (row.ranks[key] !== null) ranks[key] = row.ranks[key] as number;
    }
    return {
      retailer: "daiso",
      id: `daiso:${row.productNo}`,
      productNo: row.productNo,
      nameKr: row.nameKr,
      brand: row.brand,
      categoryKr: row.categoryKr,
      subcategoryKr: row.subcategoryKr,
      priceWon: row.priceWon,
      rating: row.rating,
      reviewCountText: row.reviewCountText,
      productUrl: row.productUrl,
      collectedAt: DAISO_RANKING_SOURCE.collectedAt,
      ranks,
      delivery: { ...row.delivery },
    };
  });
  if (products.length !== 38) throw new Error(`Daiso ranking TOP20 union must contain exactly 38 products; received ${products.length}`);

  return {
    source: {
      sourceFile: DAISO_RANKING_SOURCE.sourceFile,
      sha256: sourceSha256.toLowerCase(),
      rowCount: DAISO_RANKING_SOURCE.rowCount,
      collectedAt: DAISO_RANKING_SOURCE.collectedAt,
      seller: DAISO_RANKING_SOURCE.seller,
    },
    products,
  };
}
