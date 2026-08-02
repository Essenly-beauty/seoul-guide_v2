import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";

// Splash (Spotify-style reference, 2026-08-02): pure black field, brand
// lockup dead-center, nothing else.
export default function Loading() {
  return (
    <div
      className="app-scroll"
      style={{ display: "grid", placeItems: "center", background: "#060708" }}
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
