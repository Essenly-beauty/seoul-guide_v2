"use client";

/**
 * A session-scoped record of the place a visitor hearted immediately before
 * choosing to create an account. Guests save nothing themselves, so this is
 * the save request itself, not just an acknowledgement: it stays stored until
 * the favorites store confirms the save after the optional onboarding screen
 * returns them to their original view. Each request carries its own id, so a
 * save that finishes late can only ever clear the request it belongs to.
 */
export type PendingFavoriteReturn = { placeId: string; placeName: string; requestId?: string; /** The account that first tried to save it; no other account ever does. */ claimedBy?: string };

const KEY = "myseouldrop.signup-return.favorite";

function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function setPendingFavoriteReturn(value: PendingFavoriteReturn): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, requestId: value.requestId ?? newRequestId() }));
  } catch {
    // Private browsing or storage restrictions should never block sign-up.
  }
}

/** null = nothing stored; undefined = stored but unreadable. */
function readStored(): PendingFavoriteReturn | null | undefined {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingFavoriteReturn>;
    if (typeof value.placeId === "string" && typeof value.placeName === "string") {
      return { placeId: value.placeId, placeName: value.placeName, ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}), ...(typeof value.claimedBy === "string" ? { claimedBy: value.claimedBy } : {}) };
    }
  } catch {
    // fall through — unreadable
  }
  return undefined;
}

/** Read without consuming — the caller clears it once the save is confirmed.
    A request stored before request ids existed gets one on first read, so a
    late completion can never be mistaken for a newer request for the same
    place (codex review 2026-10-21). */
export function peekPendingFavoriteReturn(): PendingFavoriteReturn | null {
  try {
    const stored = readStored();
    if (stored === undefined) {
      sessionStorage.removeItem(KEY); // unreadable — drop it rather than retry it forever
      return null;
    }
    if (stored && !stored.requestId) {
      const upgraded = { ...stored, requestId: newRequestId() };
      sessionStorage.setItem(KEY, JSON.stringify(upgraded));
      return upgraded;
    }
    return stored;
  } catch {
    return null;
  }
}

/** Whether `stored` is the request `expected` refers to: by id when both carry
    one, by place for a request written before ids existed. */
export function isSamePendingFavoriteReturn(stored: PendingFavoriteReturn, expected: PendingFavoriteReturn): boolean {
  if (stored.requestId && expected.requestId) return stored.requestId === expected.requestId;
  return stored.placeId === expected.placeId;
}

/** Clear the stored request — only while it is still `expected` when one is
    given, so a save that finishes late never deletes a newer visitor's request
    (codex review 2026-10-20). */
export function clearPendingFavoriteReturn(expected?: PendingFavoriteReturn): void {
  try {
    if (expected) {
      const stored = readStored();
      if (stored && !isSamePendingFavoriteReturn(stored, expected)) return;
    }
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing stored to clear
  }
}

/** The request for the signed-in account `uid`: claimed by `uid` on first
    sight, so a save that fails or finishes after an account change is never
    replayed into another account; a request another account claimed is
    dropped instead (fav-flow-2 / tests-2). */
export function claimPendingFavoriteReturn(uid: string): PendingFavoriteReturn | null {
  try {
    const stored = peekPendingFavoriteReturn();
    if (!stored) return null;
    if (stored.claimedBy && stored.claimedBy !== uid) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (stored.claimedBy === uid) return stored;
    const claimed = { ...stored, claimedBy: uid };
    sessionStorage.setItem(KEY, JSON.stringify(claimed));
    return claimed;
  } catch {
    return null;
  }
}

/** A signed-in member toggled this place themselves: their own choice
    replaces the pre-signup request for it (fav-flow-3). */
export function retirePendingFavoriteReturn(placeId: string): void {
  try {
    if (readStored()?.placeId === placeId) sessionStorage.removeItem(KEY);
  } catch {
    // nothing stored
  }
}

/** Read and consume in one step. */
export function takePendingFavoriteReturn(): PendingFavoriteReturn | null {
  const value = peekPendingFavoriteReturn();
  clearPendingFavoriteReturn();
  return value;
}

export function favoriteSavedMessage(placeName: string): string {
  return `${placeName} saved. Added to My Seoul Drop`;
}

export function favoriteSaveFailedMessage(placeName: string): string {
  return `Couldn't save ${placeName} yet — we'll try again on your next screen`;
}
