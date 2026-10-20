import { cache } from 'react';
import { getPlace } from './data';
import { supabaseServer } from './supabase/server';
import { getPublicStoreProfile } from './partner/profile-server';
import { publicStoreProfile, type PublicStoreProfile } from './partner/profile-contracts';
import { mergePublicPlaceProfile } from './place-profile';
import { getPublicMerchantMedia } from './partner/media-server';
import type { MerchantMedia } from './partner/media-contracts';
import { publicPlaceMedia, mergePublicPlaceMedia } from './place-media';

/** Request-scoped only: metadata and the page share a fresh public RPC result. */
export const readPublicPlaceProfile = cache(async (placeId: string): Promise<PublicStoreProfile> => {
  try {
    const profile = await getPublicStoreProfile(await supabaseServer(), placeId);
    if (publicStoreProfile(profile) && profile.placeId === placeId) return profile;
  } catch {
    // Directory content remains available when the optional venue profile is unavailable.
  }
  return { status: 'unpublished', placeId };
});

export const readPublicPlaceMedia = cache(async (placeId: string): Promise<MerchantMedia[]> => {
  try {
    const media = await getPublicMerchantMedia(await supabaseServer(), placeId);
    if (publicPlaceMedia(media, placeId)) return media;
  } catch {
    // Approved directory photos remain available if optional merchant storage is unavailable.
  }
  return [];
});

export const getPublishedPlace = cache(async (placeId: string) => {
  const place = getPlace(placeId);
  if (!place) return undefined;
  const [profile, media] = await Promise.all([readPublicPlaceProfile(place.id), readPublicPlaceMedia(place.id)]);
  return mergePublicPlaceMedia(mergePublicPlaceProfile(place, profile), media);
});
