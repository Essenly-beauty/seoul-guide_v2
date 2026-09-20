// Validation for the public /api/vitals beacon. The endpoint is
// unauthenticated by design (the browser posts on page hide), so the shape,
// ranges and lengths are enforced here before a row reaches web_vitals.

export const VITAL_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type VitalName = (typeof VITAL_NAMES)[number];
const RATINGS = ["good", "needs-improvement", "poor"] as const;
const MAX_VALUE = 600_000; // 10 minutes in ms; CLS is unitless and tiny

export type VitalsRow = {
  name: VitalName;
  value: number;
  rating: (typeof RATINGS)[number];
  metric_id: string;
  navigation_type: string | null;
  page: string;
  target: string | null;
};

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}

export function normalizeVitalsPayload(input: unknown): VitalsRow | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const name = VITAL_NAMES.find((n) => n === o.name);
  const rating = RATINGS.find((r) => r === o.rating);
  const value = typeof o.value === "number" ? o.value : Number.NaN;
  const metricId = text(o.id, 64);
  const rawPage = text(o.page, 300);
  if (!name || !rating || !metricId || !rawPage) return null;
  if (!Number.isFinite(value) || value < 0 || value > MAX_VALUE) return null;
  // Query strings and fragments can carry auth codes/tokens — keep the path only.
  const page = rawPage.split(/[?#]/)[0].slice(0, 300);
  return {
    name,
    value,
    rating,
    metric_id: metricId,
    navigation_type: text(o.navigationType, 32),
    page,
    target: text(o.target, 200),
  };
}
