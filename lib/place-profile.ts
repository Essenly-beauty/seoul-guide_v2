import type { MerchantMedia } from './partner/media-contracts';
import type { Place } from './data';
import { publicStoreProfile, type StoreProfile } from './partner/profile-contracts';

export type PublishedPlace = Place & { publishedMedia?: MerchantMedia[]; publishedContact?: Pick<StoreProfile, 'contactPhone' | 'contactEmail' | 'notice'>; /** Partner admin switch for the photo header (default on). */ photosEnabled?: boolean };

/** The public boundary has no pending-review fields. Invalid or foreign snapshots leave directory data intact. */
export function mergePublicPlaceProfile(place: Place, value: unknown): PublishedPlace {
  if (!publicStoreProfile(value) || value.status !== 'published' || value.placeId !== place.id) return place;
  const profile = value.profile;
  const addressChanged = profile.address.trim() !== place.address.trim();
  return {
    ...place,
    name: profile.nameEn.trim() || profile.nameKo,
    nameKr: profile.nameKo,
    address: profile.address,
    about: profile.introductionEn || undefined,
    aboutKr: profile.introductionKo || undefined,
    englishOk: profile.englishOk,
    photosEnabled: profile.showPhotos ?? true,
    publishedContact: { contactPhone: profile.contactPhone, contactEmail: profile.contactEmail, notice: profile.notice },
    // A reviewed text address does not verify the directory's old coordinates.
    ...(addressChanged ? { geoSource: 'area' as const, stationWalk: undefined } : {}),
  };
}
