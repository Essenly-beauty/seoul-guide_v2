import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";

// Splash (Spotify-style reference, 2026-08-02): brand lockup dead-center on
// the theme's own field — a black flash in light mode read as a glitch.
export default function Loading() {
  return (
    <div
      className="app-scroll"
      style={{ display: "grid", placeItems: "center", background: "var(--bg)" }}
      role="status"
      aria-label="Loading"
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 14, animation: "pulse 1.6s ease-in-out infinite" }}>
        <BrandMark size={64} />
        <BrandWordmark size={15} />
      </div>
    </div>
  );
}
