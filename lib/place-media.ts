import { merchantMediaList, type MerchantMedia } from './partner/media-contracts';
import type { PublishedPlace } from './place-profile';

/** Public images must be active and delivered through this exact place's public endpoint. */
export function publicPlaceMedia(value: unknown, placeId: string): value is MerchantMedia[] {
  return merchantMediaList(value) && value.every(item => item.status === 'active' && item.url === `/api/places/${placeId}/media/${item.id}`);
}
export function publicPlaceMediaResponse(value: unknown, placeId: string): value is { media: MerchantMedia[] } {
  return !!value && typeof value === 'object' && 'media' in value && publicPlaceMedia(value.media, placeId);
}
export function mergePublicPlaceMedia(place: PublishedPlace, value: unknown): PublishedPlace {
  if (!publicPlaceMedia(value, place.id) || !value.length) return place;
  const storePhotos = value.filter(item => item.targetKind === 'store');
  return { ...place, publishedMedia: value, ...(storePhotos.length ? { photos: storePhotos.map(item => item.url), photoUrl: storePhotos[0].url } : {}) };
}
