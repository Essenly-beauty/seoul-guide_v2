// English display names for the Daiso ranking.
//
// lib/generated/daiso-ranking-products.ts is rebuilt from a SHA-pinned CSV and
// must never be hand-edited, so the English names live in an override file
// keyed by product number — the same pattern as scripts/lib/kr-name-overrides
// .json. Each entry records the Korean name it was verified against, so a
// re-import that moves a name is caught by lib/daiso-ranking-en.test.ts rather
// than silently shipping a stale translation.
//
// Names were checked one product at a time against daisomall.co.kr on
// 2026-09-20; `source` says whether the English came from the brand, an
// international retailer, or is a functional translation of a Daiso own-label
// item.

import overrides from "../scripts/lib/daiso-ranking-en-overrides.json";

type Override = {
  nameEn: string;
  brandEn: string;
  nameKrAtVerification: string;
  source: string;
  sourceUrl: string;
  confidence: string;
};

const OVERRIDES = overrides as unknown as Record<string, Override>;

/** The subcategory values the ranking actually renders. */
export const DAISO_SUBCATEGORY_LABELS: Record<string, string> = {
  기초: "Skincare",
  기타: "Other",
  "도구/소품": "Tools & Accessories",
  "마스크팩/패치": "Masks & Patches",
  바디: "Body",
  색조: "Makeup",
  생활위생: "Household & Hygiene",
  "샴푸/헤어": "Hair",
};

export function daisoSubcategoryEn(subcategoryKr: string): string {
  return DAISO_SUBCATEGORY_LABELS[subcategoryKr] ?? subcategoryKr;
}

export function daisoNameEn(productNo: string, options?: { requireFreshFor?: string }): string {
  const entry = OVERRIDES[productNo];
  if (!entry) return "";
  if (options?.requireFreshFor !== undefined && entry.nameKrAtVerification !== options.requireFreshFor) return "";
  return entry.nameEn;
}

export function daisoBrandEn(productNo: string): string {
  return OVERRIDES[productNo]?.brandEn ?? "";
}

/** Where a given English name came from, for the data-provenance surface. */
export function daisoNameEnSource(productNo: string): { source: string; url: string; confidence: string } | null {
  const entry = OVERRIDES[productNo];
  return entry ? { source: entry.source, url: entry.sourceUrl, confidence: entry.confidence } : null;
}
