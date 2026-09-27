"use client";

import { useState, type ReactNode } from "react";

/** A chain image, deliberately separate from verified photos of a branch. */
export function OliveYoungBrandHero({
  className = "",
  fallback,
}: {
  className?: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;

  return (
    <div className={`olive-young-brand-hero ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brands/olive-young-hero.avif"
        alt="Olive Young brand image, not a photo of this store"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <span className="olive-young-brand-hero-caption">Brand image</span>
    </div>
  );
}
