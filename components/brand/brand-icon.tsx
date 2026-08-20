const BRAND_MONOGRAMS: Record<string, string> = {
  Anua: "AN",
  "Beauty of Joseon": "BOJ",
  COSRX: "CX",
  "Dashing Diva": "DD",
  Illiyoon: "IY",
  Klairs: "KL",
  Mediheal: "MH",
  "Mise en Scène": "MS",
  ohora: "OH",
  "rom&nd": "R&",
  "Round Lab": "RL",
  Tamburins: "TB",
  Tsubaki: "TS",
};

/**
 * Quiet data-driven brand marker. These are intentionally typographic
 * monograms, not fabricated official logos; an approved asset can replace
 * each entry without changing the ranking row layout.
 */
export function BrandIcon({ brand }: { brand: string }) {
  const monogram = BRAND_MONOGRAMS[brand] ?? brand.slice(0, 2).toUpperCase();
  return (
    <span className="brand-icon" aria-label={`${brand} brand`} title={brand}>
      {monogram}
    </span>
  );
}

export { BRAND_MONOGRAMS };
