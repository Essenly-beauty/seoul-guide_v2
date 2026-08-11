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

export type MyRating = { rating: number; body?: string; at?: string };
export type RatingMap = Record<string, MyRating>;

/** ratings.body DB check is 2000 chars — mirror it client-side. */
export const REVIEW_MAX_LEN = 2000;

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
type PendingOp = { placeId: string; rating: number; body?: string | null; at: string; seq: number };
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
      const { body, at } = v as MyRating;
      out[id] = {
        rating: (v as MyRating).rating,
        ...(validBody(body) ? { body } : {}),
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
    const { data, error } = await supabase.from("ratings").select("place_id, rating, body, updated_at");
    if (!error) {
      const map: RatingMap = {};
      for (const row of data ?? []) {
        if (validRating(row.rating)) {
          map[row.place_id] = {
            rating: row.rating,
            ...(validBody(row.body) ? { body: row.body } : {}),
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
    if (localStorage.getItem(MERGED_KEY) === uid) return true;
  } catch { /* proceed — worst case the upsert is a no-op */ }
  const local = loadLocal();
  const rows = Object.entries(local).map(([place_id, v]) => ({
    user_id: uid,
    place_id,
    rating: v.rating,
    ...(validBody(v.body) ? { body: v.body } : {}),
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
    map[op.placeId] = { rating: op.rating, ...(body ? { body } : {}), at: op.at };
  });
  return map;
}

function sendOp(uid: string, op: PendingOp, prev: MyRating | undefined) {
  const supabase = supabaseBrowser();
  void supabase
    .from("ratings")
    .upsert(
      {
        user_id: uid,
        place_id: op.placeId,
        rating: op.rating,
        // omit body entirely on stars-only ops so an existing review survives
        ...(op.body !== undefined ? { body: op.body } : {}),
      },
      { onConflict: "user_id,place_id" },
    )
    .then(({ error }) => {
      const cur = pending.get(op.placeId);
      if (cur?.seq !== op.seq) return; // superseded by a newer tap
      pending.delete(op.placeId);
      if (error && userId === uid) {
        // roll the stars back to what they showed before the tap
        const next = { ...load() };
        if (prev) next[op.placeId] = prev;
        else delete next[op.placeId];
        write(next);
      }
    });
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
      pending.forEach((op) => sendOp(uid, op, server[op.placeId]));
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
  write({ ...cur, [placeId]: { rating, ...(prev?.body ? { body: prev.body } : {}), at } });

  const op: PendingOp = { placeId, rating, at, seq: ++opSeq };
  pending.set(placeId, op);
  if (userId) sendOp(userId, op, prev);
}

/** Save (or clear, with an empty string) my review text for a rated place. */
export function setReview(placeId: string, rating: number, body: string): void {
  const cur = load();
  const prev = cur[placeId];
  const trimmed = body.trim().slice(0, REVIEW_MAX_LEN);
  const at = new Date().toISOString();
  write({ ...cur, [placeId]: { rating, ...(trimmed ? { body: trimmed } : {}), at } });

  const op: PendingOp = { placeId, rating, body: trimmed || null, at, seq: ++opSeq };
  pending.set(placeId, op);
  if (userId) sendOp(userId, op, prev);
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
