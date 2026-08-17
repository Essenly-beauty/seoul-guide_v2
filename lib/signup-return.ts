"use client";

/**
 * A session-scoped acknowledgement for a place a visitor saved immediately
 * before choosing to create an account. The favorite itself stays in the
 * normal favorites store; this only restores the user-facing confirmation
 * after the optional onboarding screen returns them to their original view.
 */
export type PendingFavoriteReturn = { placeId: string; placeName: string };

const KEY = "myseouldrop.signup-return.favorite";

export function setPendingFavoriteReturn(value: PendingFavoriteReturn): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private browsing or storage restrictions should never block sign-up.
  }
}

export function takePendingFavoriteReturn(): PendingFavoriteReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingFavoriteReturn>;
    if (typeof value.placeId !== "string" || typeof value.placeName !== "string") return null;
    return { placeId: value.placeId, placeName: value.placeName };
  } catch {
    return null;
  }
}

export function favoriteSavedMessage(placeName: string): string {
  return `${placeName} saved. Added to My Seoul Drop`;
}
