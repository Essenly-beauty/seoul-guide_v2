"use client";

// Shared favorite lists (user request 2026-08-16) — the Kakao/Naver
// "shared folder" pattern. A member snapshots their saved places into a
// row; the link (/map?list={uuid}) is the capability. Snapshot, not live:
// later edits to the sharer's hearts stay private.

import { getPlace } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";
import { looksLikeListId } from "@/lib/shared-list-id";

export { looksLikeListId } from "@/lib/shared-list-id";

export type SharedList = {
  id: string;
  title: string;
  placeIds: string[];
  createdAt: string;
  /** Saved IDs that are no longer in the public place catalogue. */
  unavailablePlaceCount?: number;
};

export type SharedListFetch =
  | { status: "ok"; list: SharedList }
  | { status: "sign-in" | "unavailable" | "retry" };

export const LIST_TITLE_MAX = 80;
export const LIST_PLACES_MAX = 300;

/** Clamp a raw title to the DB contract (1–80 chars, no bare whitespace). */
export function sanitizeListTitle(raw: string | null | undefined, fallback = "My Seoul list"): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  return (t.length > 0 ? t : fallback).slice(0, LIST_TITLE_MAX);
}

/** Keep only real, deduped place ids, capped at the DB limit. */
export function sanitizeListPlaceIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].filter((id) => Boolean(getPlace(id))).slice(0, LIST_PLACES_MAX);
}

/** Share URL for a list id on the current origin. */
export function sharedListUrl(origin: string, id: string): string {
  return `${origin}/map?list=${encodeURIComponent(id)}`;
}

/** Insert a snapshot; resolves to the new list id. Caller must be signed in (RLS). */
export async function createSharedList(title: string, placeIds: readonly string[]): Promise<string> {
  const ids = sanitizeListPlaceIds(placeIds);
  if (ids.length === 0) throw new Error("Nothing to share yet");
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const owner = userData.user?.id;
  if (!owner) throw new Error("Sign in to share");
  const { data, error } = await supabase
    .from("shared_lists")
    .insert({ owner, title: sanitizeListTitle(title), place_ids: ids })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** List the signed-in creator's snapshots; browser RLS is owner-only. */
export async function listOwnSharedLists(): Promise<SharedList[]> {
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const owner = userData.user?.id;
  if (!owner) throw new Error("Sign in to manage shared links");
  const { data, error } = await supabase
    .from("shared_lists")
    .select("id, title, place_ids, created_at")
    .eq("owner", owner)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const rawPlaceIds: string[] = Array.isArray(row.place_ids) ? row.place_ids : [];
    const placeIds = sanitizeListPlaceIds(rawPlaceIds);
    return {
      id: row.id,
      title: row.title,
      placeIds,
      createdAt: row.created_at,
      unavailablePlaceCount: Math.max(0, new Set(rawPlaceIds).size - placeIds.length),
    };
  });
}

/** Revoke only a row owned by this member; zero affected rows is not success. */
export async function revokeSharedList(id: string): Promise<void> {
  if (!looksLikeListId(id)) throw new Error("Invalid shared list link");
  const supabase = supabaseBrowser();
  const { data: userData } = await supabase.auth.getUser();
  const owner = userData.user?.id;
  if (!owner) throw new Error("Sign in to manage shared links");
  const { data, error } = await supabase
    .from("shared_lists")
    .delete()
    .eq("id", id)
    .eq("owner", owner)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This shared link is no longer available");
}

/** Read one list through the session-checked server route, never direct table SELECT. */
export async function fetchSharedList(id: string): Promise<SharedListFetch> {
  if (!looksLikeListId(id)) return { status: "unavailable" };
  try {
    const response = await fetch(`/api/shared-lists/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (response.status === 401) return { status: "sign-in" };
    if (response.status === 400 || response.status === 404) return { status: "unavailable" };
    if (!response.ok) return { status: "retry" };
    const row = await response.json() as { id: string; title: string; place_ids: string[]; created_at: string };
    const rawPlaceIds = Array.isArray(row.place_ids)
      ? row.place_ids.filter((placeId): placeId is string => typeof placeId === "string")
      : [];
    const placeIds = sanitizeListPlaceIds(rawPlaceIds);
    return {
      status: "ok",
      list: {
        id: row.id,
        title: row.title,
        placeIds,
        createdAt: row.created_at,
        unavailablePlaceCount: Math.max(0, new Set(rawPlaceIds).size - placeIds.length),
      },
    };
  } catch {
    return { status: "retry" };
  }
}
