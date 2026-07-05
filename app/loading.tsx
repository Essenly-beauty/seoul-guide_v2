import { BrandMark } from "@/components/icon";

export default function Loading() {
  return (
    <div className="app-scroll" style={{ display: "grid", placeItems: "center" }} role="status" aria-label="Loading">
      <BrandMark size={44} style={{ opacity: 0.5, animation: "pulse 1.2s ease-in-out infinite" }} />
    </div>
  );
}
