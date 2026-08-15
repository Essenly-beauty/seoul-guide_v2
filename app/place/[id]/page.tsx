import { notFound } from "next/navigation";
import { BackButtonBordered } from "@/components/ui/back-button";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { PlaceCtaBar } from "@/components/place/place-cta-bar";
import { routes } from "@/lib/routes";
import { getPlace } from "@/lib/data";

export default async function PlaceDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const place = getPlace(params.id);
  if (!place) notFound();

  return (
    <>
      <div className="statusbar-photo" />
      <div className="app-scroll">
        <PlaceDetailBody
          place={place}
          heroOverlay={
            /* Back only — share/save live in the action strip under the title
               (user decision 2026-07-25); duplicating them over the photos
               read as clutter (user decision). */
            <div className="row" style={{ position: "absolute", top: 14, left: 14 }}>
              <BackButtonBordered fallback={routes.map} />
            </div>
          }
        />
      </div>

      <PlaceCtaBar place={place} />
    </>
  );
}
