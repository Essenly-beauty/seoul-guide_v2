"use client";

// Shared favorite lists (user request 2026-08-16) — the Kakao/Naver
// "shared folder" pattern. A member snapshots their saved places into a
// row; the link (/map?list={uuid}) is the capability. Snapshot, not live:
// later edits to the sharer's hearts stay private.

import { getPlace } from "@/lib/data";
import { supabaseBrowser } from "@/lib/supabase/client";

export type SharedList = {
  id: string;
  title: string;
  placeIds: string[];
  createdAt: string;
};

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

/** Uuid-shaped check — skips a doomed network round-trip on junk params. */
export function looksLikeListId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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

/** Fetch a shared list by id; null when missing/invalid (never throws for a bad link). */
export async function fetchSharedList(id: string): Promise<SharedList | null> {
  if (!looksLikeListId(id)) return null;
  try {
    const { data, error } = await supabaseBrowser()
      .from("shared_lists")
      .select("id, title, place_ids, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { id: string; title: string; place_ids: string[]; created_at: string };
    const placeIds = sanitizeListPlaceIds(row.place_ids ?? []);
    if (placeIds.length === 0) return null;
    return { id: row.id, title: row.title, placeIds, createdAt: row.created_at };
  } catch {
    return null; // offline / table missing — the map just renders normally
  }
}
