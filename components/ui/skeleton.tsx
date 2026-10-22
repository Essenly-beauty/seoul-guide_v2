import type { CSSProperties, ReactNode } from "react";

// Skeleton placeholders — every loading state draws the shape of the content
// it is waiting for instead of a logo or a sentence (owner decision 2026-10-20).
// Plain markup, no hooks, so server components can use it too.
// Motion lives in globals.css (.skel) and stops under prefers-reduced-motion.

type Size = number | string;

export function Skeleton({ width = "100%", height = 14, radius = 8, className, style }: {
  width?: Size; height?: Size; radius?: Size; className?: string; style?: CSSProperties;
}) {
  return <span aria-hidden="true" className={["skel", className].filter(Boolean).join(" ")} style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Text-shaped lines of decreasing width. */
export function SkeletonLines({ lines = 3, widths, lineHeight = 13, gap = 9, className }: {
  lines?: number; widths?: readonly Size[]; lineHeight?: number; gap?: number; className?: string;
}) {
  const fallback = ["92%", "76%", "58%", "84%", "40%"];
  return (
    <span aria-hidden="true" className={["skel-lines", className].filter(Boolean).join(" ")} style={{ gap }}>
      {Array.from({ length: lines }, (_, index) => <Skeleton key={index} width={widths?.[index] ?? fallback[index % fallback.length]} height={lineHeight} radius={6} />)}
    </span>
  );
}

/** List rows: a square thumbnail beside two lines, the shape of a place/booking row. */
export function SkeletonList({ rows = 3, thumb = 56, className }: { rows?: number; thumb?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={["skel-list", className].filter(Boolean).join(" ")}>
      {Array.from({ length: rows }, (_, index) => (
        <span className="skel-row" key={index}>
          <Skeleton width={thumb} height={thumb} radius={12} />
          <span className="skel-lines" style={{ gap: 7 }}>
            <Skeleton width={`${64 - index * 9}%`} height={14} radius={6} />
            <Skeleton width={`${42 - index * 5}%`} height={11} radius={6} />
          </span>
        </span>
      ))}
    </span>
  );
}

/** Pill-shaped placeholders for chip rows (time slots, filters). */
export function SkeletonChips({ count = 6, width = 64, height = 36, className }: { count?: number; width?: Size; height?: Size; className?: string }) {
  return (
    <span aria-hidden="true" className={["skel-chips", className].filter(Boolean).join(" ")}>
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} width={width} height={height} radius={999} />)}
    </span>
  );
}

/** Accessible wrapper: announces the wait once, draws the shape instead of a sentence. */
export function SkeletonStatus({ label, children, className, style }: { label: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={label} className={["skel-status", className].filter(Boolean).join(" ")} style={style}>
      <span className="skel-sr">{label}</span>
      {children}
    </div>
  );
}
