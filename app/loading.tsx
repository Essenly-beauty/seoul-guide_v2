import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";

// Splash: brand lockup dead-center on the theme's own field (a black flash in
// light mode read as a glitch) with a thin indeterminate bar — pulsing the
// whole logo read cheap.
export default function Loading() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <div className="splash-lockup">
        <BrandMark size={66} />
        <BrandWordmark size={15} />
      </div>
      <span className="splash-bar" aria-hidden="true" />
    </div>
  );
}
