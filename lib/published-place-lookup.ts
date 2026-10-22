import type { Place } from "./data";
import type { MerchantMedia } from "./partner/media-contracts";
import { mergePublicPlaceMedia } from "./place-media";
import { mergePublicPlaceProfile, type PublishedPlace } from "./place-profile";

// Client-side twin of place-profile-server.ts for surfaces that open a place
// without a server render — the map sheet's summary and detail. The profile
// (name, English OK, contact, notice, the photo-header switch) and the photos
// come from two public endpoints and are remembered separately, so a photo
// lookup failing never costs a venue's settings (codex review 2026-10-20).

export const FRESH_MS = 60_000;
export const RETRY_MS = 20_000;
export const MAX_RETRY_MS = 5 * 60_000;

/** Only ids the publication rule accepts can ever carry a venue profile
    (merchant_publications.place_id check; the public routes answer 400 to the
    rest). Olive Young and Daiso branch ids (Hangul, "%", ":") never do. */
const PUBLISHABLE_PLACE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/;
export function canHavePublishedProfile(placeId: string): boolean {
  return PUBLISHABLE_PLACE_ID.test(placeId);
}

/** Back off after consecutive failed lookups: 20 s, 40 s, 80 s … capped. */
export function retryDelay(failures: number): number {
  return Math.min(RETRY_MS * 2 ** Math.max(0, failures - 1), MAX_RETRY_MS);
}

/** `media: null` means the photo lookup failed; the profile part is always valid. */
export type PublishedPlaceLookup = { profile: PublishedPlace; media: MerchantMedia[] | null };
/** `photosCurrent` is false when this lookup's photo request failed and `media`
    is the last good set carried over — shown, but never treated as fresh. */
export type LookupEntry = { at: number; profile: PublishedPlace; media: MerchantMedia[] | null; photosCurrent: boolean };

type Fetched = { ok: true; body: unknown } | { ok: false };

async function readJson(path: string, signal: AbortSignal): Promise<Fetched> {
  try {
    const response = await fetch(path, { signal, cache: "no-store", credentials: "same-origin" });
    return response.ok ? { ok: true, body: await response.json() } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Null when the profile lookup failed — the profile carries the venue's
    settings, and a failure is not "unpublished" (merging it would show the
    catalog defaults, a photo switch flipping back on behind a network blip).
    A failed photo lookup does not block those settings: `media` is then null. */
export async function fetchPublishedPlace(place: Place, signal: AbortSignal): Promise<PublishedPlaceLookup | null> {
  const id = encodeURIComponent(place.id);
  const [profile, media] = await Promise.all([
    readJson(`/api/places/${id}/profile`, signal),
    readJson(`/api/places/${id}/media`, signal),
  ]);
  if (!profile.ok) return null;
  const merged = mergePublicPlaceProfile(place, profile.body);
  if (!media.ok) return { profile: merged, media: null };
  const list = media.body && typeof media.body === "object" && "media" in media.body ? (media.body as { media: unknown }).media : null;
  return { profile: merged, media: Array.isArray(list) ? (list as MerchantMedia[]) : [] };
}

/** Fold a lookup into what is remembered for the pin: the profile always
    replaces the old one; failed photos keep the last good photos, marked as
    not current so the pin is re-read on the short retry schedule. */
export function rememberLookup(previous: LookupEntry | undefined, result: PublishedPlaceLookup, now: number): LookupEntry {
  return { at: now, profile: result.profile, media: result.media ?? previous?.media ?? null, photosCurrent: result.media !== null };
}

/** The place as the sheet shows it: profile first, photos layered on when known. */
export function composeLookup(entry: LookupEntry): PublishedPlace {
  return entry.media ? mergePublicPlaceMedia(entry.profile, entry.media) : entry.profile;
}

/** Fresh enough to show without a request: recent, and with this lookup's own
    photos — an entry missing photos, or showing photos carried over from an
    earlier lookup after a failed one, is shown but re-read sooner (codex
    review round 6). */
export function isFreshLookup(entry: LookupEntry | undefined, now: number, freshMs = FRESH_MS): entry is LookupEntry {
  return !!entry && entry.photosCurrent && entry.media !== null && now - entry.at < freshMs;
}
