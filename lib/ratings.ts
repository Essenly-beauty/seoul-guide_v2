"use client";

// My-ratings store — the "Been here? Rate your visit" stars on place detail,
// listed on the My reviews page and counted in the menu stats.
//
// Guests: localStorage under "essenly.myrating" (the key the prototype used;
//   legacy entries were bare numbers and are upgraded on read).
// Signed in: Supabase `ratings` table (RLS-scoped) is the source of truth.
//   Same hardened sync shape as lib/favorites.ts: one-time guest merge whose
//   flag is only consumed on success, pending-intent overlay so a stale fetch
//   can't undo a star the UI already showed, retries, and a sign-out purge
//   of the local mirror (shared-device privacy).

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";

export type MyRating = { rating: number; body?: string; isPublic?: boolean; at?: string };
export type RatingMap = Record<string, MyRating>;

/** ratings.body DB check is 2000 chars — mirror it client-side. */
export const REVIEW_MAX_LEN = 2000;

/**
 * Single policy seam for the My-review edit affordance. The current product
 * rule is owner-only: a review can be edited only when it exists in the
 * current account/device My-ratings store. Future time or moderation windows
 * belong here instead of being duplicated across screens.
 */
export function canEditMyReview(review: MyRating | null | undefined): boolean {
  return Boolean(review && validRating(review.rating));
}

const KEY = "essenly.myrating";
const MERGED_KEY = "essenly.myrating.mergedFor";
const EMPTY: RatingMap = {};

let cache: RatingMap | null = null;
let userId: string | null = null;
let authWired = false;
let hydrating = true;
let syncToken = 0;
let syncing = false;
// body: undefined = leave the server column untouched; null = clear it.
// isPublic rides along only on body ops (consent is chosen in the composer).
type PendingOp = { placeId: string; rating: number; body?: string | null; isPublic?: boolean; at: string; seq: number };
let opSeq = 0;
const pending = new Map<string, PendingOp>();
const listeners = new Set<() => void>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function notify() {
  listeners.forEach((l) => l());
}

const validRating = (n: unknown): n is number => typeof n === "number" && n >= 1 && n <= 5;

const validBody = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= REVIEW_MAX_LEN;

/** Parse either shape: legacy `{id: 4}` or current `{id: {rating, body?, at?}}`. */
export function parseRatings(raw: unknown): RatingMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RatingMap = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (validRating(v)) out[id] = { rating: v };
    else if (v && typeof v === "object" && validRating((v as MyRating).rating)) {
      const { body, isPublic, at } = v as MyRating;
      out[id] = {
        rating: (v as MyRating).rating,
        ...(validBody(body) ? { body } : {}),
        ...(validBody(body) && isPublic === true ? { isPublic: true } : {}),
        ...(typeof at === "string" ? { at } : {}),
      };
    }
  }
  return out;
}

function loadLocal(): RatingMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseRatings(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return {};
}

function load(): RatingMap {
  if (cache) return cache;
  cache = loadLocal();
  return cache;
}

function write(next: RatingMap) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — in-memory state still works for the session
  }
  notify();
}

// ── Server sync (signed-in only) ───────────────────────────

async function fetchServer(): Promise<RatingMap | null> {
  const supabase = supabaseBrowser();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from("ratings").select("place_id, rating, body, is_public, updated_at");
    if (!error) {
      const map: RatingMap = {};
      for (const row of data ?? []) {
        if (validRating(row.rating)) {
          map[row.place_id] = {
            rating: row.rating,
            ...(validBody(row.body) ? { body: row.body } : {}),
            ...(validBody(row.body) && row.is_public === true ? { isPublic: true } : {}),
            at: row.updated_at,
          };
        }
      }
      return map;
    }
    await sleep(700 * (attempt + 1));
  }
  return null;
}

/** One-time per account: bring the guest's ratings into the server.
    ignoreDuplicates — an existing account rating beats an old guest one. */
async function mergeLocalIntoServer(uid: string): Promise<boolean> {
  try {
    const owner = localStorage.getItem(MERGED_KEY);
    if (owner === uid) return true;
    if (owner && owner !== uid) {
      // previous account's mirror — purge, never merge into the new account
      // (mirrors lib/favorites.ts; codex cross-check #3)
      localStorage.removeItem(KEY);
      localStorage.removeItem(MERGED_KEY);
      pending.clear();
      cache = null;
      notify();
    }
  } catch { /* proceed — worst case the upsert is a no-op */ }
  const local = loadLocal();
  const rows = Object.entries(local).map(([place_id, v]) => ({
    user_id: uid,
    place_id,
    rating: v.rating,
    ...(validBody(v.body) ? { body: v.body, is_public: v.isPublic === true } : {}),
  }));
  if (rows.length > 0) {
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("ratings")
      .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true });
    if (error) return false; // flag stays unset so the next session retries
  }
  try {
    localStorage.setItem(MERGED_KEY, uid);
  } catch { /* ignore */ }
  return true;
}

function overlayPending(server: RatingMap): RatingMap {
  const map = { ...server };
  pending.forEach((op) => {
    // an op that doesn't touch the body keeps whatever the server had
    const body = op.body === undefined ? map[op.placeId]?.body : op.body ?? undefined;
    const isPublic = op.body === undefined ? map[op.placeId]?.isPublic : op.isPublic;
    map[op.placeId] = { rating: op.rating, ...(body ? { body } : {}), ...(body && isPublic ? { isPublic: true } : {}), at: op.at };
  });
  return map;
}

async function sendOp(uid: string, op: PendingOp, prev: MyRating | undefined): Promise<boolean> {
  const supabase = supabaseBrowser();
  let error: unknown = null;
  try {
    const result = await supabase.from("ratings").upsert(
      {
        user_id: uid,
        place_id: op.placeId,
        rating: op.rating,
        // omit body entirely on stars-only ops so an existing review survives
        ...(op.body !== undefined ? { body: op.body, is_public: op.body !== null && op.isPublic === true } : {}),
      },
      { onConflict: "user_id,place_id" },
    );
    error = result.error;
  } catch (cause) {
    error = cause;
  }

  const cur = pending.get(op.placeId);
  if (cur?.seq !== op.seq) return error === null; // superseded by a newer tap
  pending.delete(op.placeId);
  if (error && userId === uid) {
    // Roll back only after a confirmed persistence failure. Callers that await
    // this result keep their draft open instead of navigating away.
    const next = { ...load() };
    if (prev) next[op.placeId] = prev;
    else delete next[op.placeId];
    write(next);
  }
  return error === null;
}

async function adoptServerState(uid: string) {
  const token = ++syncToken;
  syncing = true;
  notify();
  try {
    if (!(await mergeLocalIntoServer(uid))) return; // keep the local view; retry next session
    const server = await fetchServer();
    if (server && userId === uid && token === syncToken) {
      write(overlayPending(server));
      pending.forEach((op) => { void sendOp(uid, op, server[op.placeId]); });
    }
  } finally {
    if (token === syncToken) syncing = false;
    hydrating = false;
    notify();
  }
}

function settleAsGuest(clearMirror: boolean) {
  const changed = hydrating || syncing;
  hydrating = false;
  syncing = false;
  syncToken++;
  if (clearMirror) {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(MERGED_KEY);
    } catch { /* ignore */ }
    pending.clear();
  }
  if (userId !== null || clearMirror) {
    userId = null;
    cache = null;
    notify();
  } else if (changed) {
    notify();
  }
}

/** Remove the signed-out account's local mirror — called from the sign-out
    action directly; idempotent with the SIGNED_OUT handler. */
export function purgeRatingsMirror(): void {
  settleAsGuest(true);
}

function wireAuth() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  const supabase = supabaseBrowser();
  supabase.auth.getUser().then(({ data }) => {
    if (data.user && userId !== data.user.id) {
      userId = data.user.id;
      void adoptServerState(data.user.id);
    } else if (!data.user && userId === null) {
      // expired/revoked session left an account mirror behind — purge it
      // (mirrors lib/favorites.ts; explicit sign-out is handled below)
      let stale = false;
      try {
        stale = localStorage.getItem(MERGED_KEY) !== null;
      } catch { /* ignore */ }
      settleAsGuest(stale);
    }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const nextId = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || nextId === null) {
      settleAsGuest(event === "SIGNED_OUT" && userId !== null);
      return;
    }
    if (nextId !== userId) {
      userId = nextId;
      void adoptServerState(nextId);
    }
  });
}

/** Set (or change) my rating for a place — optimistic, server-backed.
    Stars only; an existing review text is left untouched. */
export function setRating(placeId: string, rating: number): void {
  const cur = load();
  const prev = cur[placeId];
  const at = new Date().toISOString();
  write({ ...cur, [placeId]: { rating, ...(prev?.body ? { body: prev.body } : {}), ...(prev?.body && prev.isPublic ? { isPublic: true } : {}), at } });

  const op: PendingOp = { placeId, rating, at, seq: ++opSeq };
  pending.set(placeId, op);
  if (userId) void sendOp(userId, op, prev);
}

/** Save (or clear, with an empty string) my review text for a rated place.
    isPublic is the composer's explicit consent — public reviews show the
    author's first name to other travelers. */
export async function setReview(placeId: string, rating: number, body: string, isPublic = false): Promise<boolean> {
  const cur = load();
  const prev = cur[placeId];
  const trimmed = body.trim().slice(0, REVIEW_MAX_LEN);
  const share = Boolean(trimmed) && isPublic;
  const at = new Date().toISOString();
  write({ ...cur, [placeId]: { rating, ...(trimmed ? { body: trimmed } : {}), ...(share ? { isPublic: true } : {}), at } });

  const op: PendingOp = { placeId, rating, body: trimmed || null, isPublic: share, at, seq: ++opSeq };
  pending.set(placeId, op);
  if (userId) return sendOp(userId, op, prev);
  return true;
}

function subscribe(cb: () => void) {
  wireAuth();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && !userId) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live ratings map — components re-render whenever a star is set anywhere. */
export function useMyRatings(): RatingMap {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

const readyNow = () => !hydrating && !syncing;

/** False until the session check (and first server fetch when signed in)
    settles — mirrors useFavoritesReady. */
export function useMyRatingsReady(): boolean {
  return useSyncExternalStore(subscribe, readyNow, () => false);
}
