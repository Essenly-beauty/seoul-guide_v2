"use client";

import { useReportWebVitals } from "next/web-vitals";
import { isVitalName } from "@/lib/web-vitals-payload";

// Real-user Core Web Vitals → /api/vitals. Kept as its own tiny client
// component so the root layout stays a server component (Next.js docs).
// The INP entry's target selector is included so a slow interaction can be
// traced to the element without a paid RUM tier.

type VitalsMetric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  id: string;
  navigationType?: string;
  entries?: PerformanceEntry[];
};

function targetSelector(entries: PerformanceEntry[] | undefined): string | undefined {
  const el = (entries?.[0] as { target?: Element | null } | undefined)?.target;
  if (!el || !(el instanceof Element)) return undefined;
  const id = el.id ? `#${el.id}` : "";
  const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join(".")}` : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 200);
}

function send(metric: VitalsMetric) {
  if (process.env.NODE_ENV !== "production") return;
  // Next.js mixes its own framework timings into this callback; they are not
  // Core Web Vitals and the endpoint rejects them (400 on every load).
  if (!isVitalName(metric.name)) return;
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    target: metric.name === "INP" ? targetSelector(metric.entries) : undefined,
  });
  try {
    // text/plain keeps the beacon a "simple request" — no CORS preflight,
    // and sendBeacon survives page hide (which is when INP/CLS finalize).
    if (navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "text/plain" }))) return;
    void fetch("/api/vitals", { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } });
  } catch {
    // never surface metrics failures
  }
}

export function WebVitalsReporter() {
  useReportWebVitals(send);
  return null;
}
