import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackButtonBordered } from "@/components/ui/back-button";
import { PlaceDetailBody } from "@/components/place/place-detail-body";
import { PlaceCtaBar } from "@/components/place/place-cta-bar";
import { routes } from "@/lib/routes";
import { getPublishedPlace } from "@/lib/place-profile-server";
import { placeJsonLd, placeMetadata } from "@/lib/place-seo";

type Props = { params: Promise<{ id: string }> };

// Unique title/description/canonical/OG per place (Google Search Central,
// ogp.me). The route announcer also reads document.title, so this is what
// VoiceOver hears on arrival. notFound() is thrown HERE, before any byte of
// the page is sent, so an unknown id is a real 404. There is deliberately no
// route-level loading.tsx (lib/route-loading-contract.test.ts): a streamed
// skeleton made the page body hydrate late and fail intermittently.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const place = await getPublishedPlace(id);
  if (!place) notFound();
  return placeMetadata(place);
}

export default async function PlaceDetailPage(props: Props) {
  const params = await props.params;
  const place = await getPublishedPlace(params.id);
  if (!place) notFound();

  // "<" is escaped so a data value can never close the script element.
  const jsonLd = JSON.stringify(placeJsonLd(place)).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
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
