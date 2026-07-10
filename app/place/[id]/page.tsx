import { notFound } from "next/navigation";
import { BackButtonBordered } from "@/components/ui/back-button";
import { ActionButton } from "@/components/ui/action-button";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Icon } from "@/components/icon";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { PlaceCtaBar } from "@/components/place/place-cta-bar";
import { routes } from "@/lib/routes";
import { getPlace } from "@/lib/data";

export default function PlaceDetailPage({ params }: { params: { id: string } }) {
  const place = getPlace(params.id);
  if (!place) notFound();

  return (
    <>
      <div className="statusbar-photo" />
      <div className="app-scroll">
        <PlaceDetailBody
          place={place}
          heroOverlay={
            <div className="row between" style={{ position: "absolute", top: 14, left: 14, right: 14 }}>
              <BackButtonBordered fallback={routes.map} />
              <span className="row" style={{ gap: 8 }}>
                <ActionButton className="iconbtn bordered" aria-label="Share" share={`${place.name} on Essenly`}>
                  <Icon name="share" size="sm" />
                </ActionButton>
                <FavoriteButton variant="bordered" />
              </span>
            </div>
          }
        />
      </div>

      <PlaceCtaBar place={place} />
    </>
  );
}
