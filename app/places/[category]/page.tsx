import { notFound } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { PlacesContent } from "@/components/places/places-content";
import { CATEGORY_META, PLACES } from "@/lib/data";
import { routes } from "@/lib/routes";

export default function PlacesCategoryPage({ params }: { params: { category: string } }) {
  const meta = CATEGORY_META[params.category];
  if (!meta) notFound();

  const places = PLACES.filter((p) => meta.types.includes(p.type));

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.map} />} title={meta.title} />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">{meta.eyebrow}</div>
          <div className="h1">
            {meta.line1} <span style={{ fontStyle: "italic", color: "var(--accent)" }}>{meta.line2}</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>{meta.blurb}</p>
        </div>

        <PlacesContent category={params.category} places={places} />
      </div>
      <BottomNav active="map" />
    </>
  );
}
