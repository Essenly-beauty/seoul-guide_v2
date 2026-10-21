"use client";

// Shared favorites store — hearts stay in sync across the map sheet, place
// detail, shop, and the Saved tab.
//
// Guests save nothing (owner decision 2026-10-20): a heart tapped without an
// account opens the join sheet, and the place is saved once they return
// signed in (lib/signup-return.ts + SignupReturnNotice).
//
// Signed in, the Supabase `favorites` table (RLS-scoped) is the source of
// truth, held per account in a Session. Per item the view is `desired ?? base`:
//   base     — what the server is known to hold: the account snapshot with
//              every write that landed applied on top (the device mirror
//              until the snapshot lands);
//   desired  — the member's latest intent the server has not confirmed yet;
//   inflight — the one request on the wire for the item (never two, so the
//              server always receives an item's writes in order).
// A request that settles updates `base` if it landed, then drops its intent
// if that intent is still the latest — success shows the server's new state,
// failure shows the server's old state; there is no rollback target to keep.
// An account change replaces the Session; a completion for an old session can
// only answer its own caller (codex review 2026-10-20/21, review workflow).
//
// The localStorage copy is the signed-in account's mirror for a fast first
// paint, tagged with its owner. Sign-out wipes it (shared-device privacy); a
// mirror owned by another account is dropped, never merged; an untagged
// legacy guest list from before the guest policy merges into the account once.

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";
import { clearPendingFavoriteReturn, retirePendingFavoriteReturn } from "./signup-return";
import { isDefiniteSignOut } from "./auth/session-errors";

export type FavKind = "place" | "product" | "article";
export type FavMap = Record<FavKind, string[]>;
export type FavoriteSaveResult = "saved" | "failed" | "superseded";

const KEY = "essenly.favorites";
const MERGED_KEY = "essenly.favorites.mergedFor";
const OWNER_KEY = "essenly.favorites.owner";
const EMPTY: FavMap = { place: [], product: [], article: [] };
const KINDS: FavKind[] = ["place", "product", "article"];
const GUEST_EMPTY: FavMap = Object.freeze({ place: [], product: [], article: [] }) as FavMap;

type Session = {
  uid: string;
  base: FavMap;
  /** base came from a server snapshot (else it is still the device mirror). */
  known: boolean;
  desired: Map<string, boolean>;
  inflight: Map<string, boolean>;
  /** Send a confirmation even when base already agrees (saveFavorite: mirror rows may never have reached the server). */
  force: Set<string>;
  /** Writes that landed while the snapshot request was outstanding; null otherwise. */
  landedDuringSnapshot: Map<string, boolean> | null;
  waiters: Map<string, ((result: FavoriteSaveResult) => void)[]>;
  /** base holds rows still to be merged into this account (a legacy guest list, or a merge that failed last time). */
  legacyMirror: boolean;
};

let session: Session | null = null;
// Sessions that ended with requests still on the wire, by account. If that
// account signs straight back in, its new session takes the old one over, so
// those requests land in the right place and new writes queue behind them.
const ended = new Map<string, Session>();
// Every startSession call takes a token; only the newest may finish the sync —
// a revived session object can otherwise have two sign-in flows in flight.
let starts = 0;
// Readiness: `hydrating` covers the initial session check; `syncing` covers a
// signed-in account's server fetch. Until both settle, the Saved tab shows a
// loading state instead of flashing "nothing saved" on a fresh device.
let hydrating = true;
let syncing = false;
let authWired = false;
let view: FavMap | null = null;
let guestMirror: FavMap | null = null;
const listeners = new Set<() => void>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const keyOf = (kind: FavKind, id: string) => `${kind}:${id}`;
function parseKey(key: string): [FavKind, string] {
  const i = key.indexOf(":");
  return [key.slice(0, i) as FavKind, key.slice(i + 1)];
}
const includes = (map: FavMap, kind: FavKind, id: string) => map[kind].includes(id);
function setIn(map: FavMap, kind: FavKind, id: string, saved: boolean): FavMap {
  if (includes(map, kind, id) === saved) return map;
  return { ...map, [kind]: saved ? [id, ...map[kind]] : map[kind].filter((x) => x !== id) };
}

function loadLocal(): FavMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FavMap>;
      return {
        place: Array.isArray(parsed.place) ? parsed.place : [],
        product: Array.isArray(parsed.product) ? parsed.product : [],
        article: Array.isArray(parsed.article) ? parsed.article : [],
      };
    }
  } catch {
    // fall through to empty
  }
  return { place: [], product: [], article: [] };
}

function persistLocal(uid: string, next: FavMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.setItem(OWNER_KEY, uid);
  } catch {
    // storage unavailable — in-memory state still works for the session
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(MERGED_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch { /* ignore */ }
}

function derive(s: Session): FavMap {
  let map = s.base;
  s.desired.forEach((saved, key) => {
    const [kind, id] = parseKey(key);
    map = setIn(map, kind, id, saved);
  });
  return map;
}

// useSyncExternalStore needs a stable snapshot: `view` is cached until emit().
function load(): FavMap {
  if (session) return (view ??= derive(session));
  if (!hydrating) return GUEST_EMPTY;
  return (guestMirror ??= loadLocal());
}

function emit() {
  view = null;
  if (session) persistLocal(session.uid, load());
  listeners.forEach((l) => l());
}

function resolveWaiters(s: Session, key: string, result: FavoriteSaveResult) {
  const list = s.waiters.get(key);
  if (!list) return;
  s.waiters.delete(key);
  list.forEach((resolve) => resolve(result));
}

const requestFailed = (cause: unknown) => ({ error: cause ?? new Error("request failed") });

function request(uid: string, kind: FavKind, id: string, saved: boolean): Promise<{ error: unknown }> {
  const supabase = supabaseBrowser();
  const req = saved
    ? supabase.from("favorites").upsert(
        { user_id: uid, kind, item_id: id },
        { onConflict: "user_id,kind,item_id", ignoreDuplicates: true },
      )
    : supabase.from("favorites").delete().match({ user_id: uid, kind, item_id: id });
  return Promise.resolve(req).then((r: { error: unknown }) => r, requestFailed);
}

/** Put the one request for `key` on the wire and settle it into the session. */
function dispatch(s: Session, key: string, want: boolean) {
  const [kind, id] = parseKey(key);
  s.inflight.set(key, want);
  void request(s.uid, kind, id, want).then(({ error }) => {
    s.inflight.delete(key);
    if (!error) {
      s.base = setIn(s.base, kind, id, want);
      s.landedDuringSnapshot?.set(key, want); // the snapshot in flight may have been read before this landed
    }
    if (s.desired.get(key) === want) s.desired.delete(key); // settled: the view now shows base
    // A failed confirmation of a row the account snapshot already holds is still a saved row.
    if (want) resolveWaiters(s, key, !error || (s.known && includes(s.base, kind, id)) ? "saved" : "failed");
    if (session !== s) { forgetIfIdle(s); return; } // an old account: its caller got the answer, nothing else changes
    emit();
    reconcile(s, key); // a newer intent made meanwhile goes out now
  });
}

function forgetIfIdle(s: Session) {
  if (s.inflight.size === 0 && ended.get(s.uid) === s) ended.delete(s.uid);
}

function reconcile(s: Session, key: string) {
  if (session !== s || s.inflight.has(key)) return;
  const want = s.desired.get(key);
  if (want === undefined) return;
  const [kind, id] = parseKey(key);
  if (s.known && includes(s.base, kind, id) === want) {
    // The server already holds it. Once the snapshot is known that settles a
    // save too: the confirmation only guards rows the mirror may hold alone.
    s.desired.delete(key);
    s.force.delete(key);
    if (want) resolveWaiters(s, key, "saved");
    emit();
    return;
  }
  s.force.delete(key);
  dispatch(s, key, want);
}

// Dispatch after the current task, so taps made in the same tick coalesce.
const schedule = (s: Session, key: string) => queueMicrotask(() => reconcile(s, key));

// ── Server sync (signed-in only) ───────────────────────────

async function fetchServer(uid: string): Promise<FavMap | null> {
  const supabase = supabaseBrowser();
  // brief retry — a transient failure here would otherwise flip the Saved
  // tab to an authoritative-looking wrong (usually empty) list all session
  for (let attempt = 0; attempt < 3; attempt++) {
    // Scoped to the session's account, not just to whatever token the client
    // holds: a session never adopts another account's rows (review 2026-10-21).
    const { data, error } = await supabase
      .from("favorites")
      .select("kind, item_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!error) {
      const map: FavMap = { place: [], product: [], article: [] };
      for (const row of data ?? []) {
        if (KINDS.includes(row.kind as FavKind)) map[row.kind as FavKind].push(row.item_id);
      }
      return map;
    }
    await sleep(700 * (attempt + 1));
  }
  return null;
}

/** The device mirror this account may start from, read before anything
    re-tags it. A mirror another account left behind (its session ended
    without our purge running, or another tab signed in as someone else) is
    dropped, never merged. Otherwise it is this account's own cache or an
    untagged legacy guest list from before the guest policy; until a merge has
    completed for this account (MERGED_KEY) its rows are merged once — the
    retry after a failed merge included. Once merged, the mirror is only a
    cache and is never written back (that could resurrect a heart removed on
    another device). */
function mirrorFor(uid: string): { base: FavMap; legacy: boolean } {
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    const mergedFor = localStorage.getItem(MERGED_KEY);
    if ((owner && owner !== uid) || (mergedFor && mergedFor !== uid)) {
      clearLocal();
      return { base: { place: [], product: [], article: [] }, legacy: false };
    }
    return { base: loadLocal(), legacy: mergedFor === null };
  } catch {
    return { base: { place: [], product: [], article: [] }, legacy: false };
  }
}

/** One-time per account: union an untagged legacy guest list into the server.
    Each row is a forced save on the item's single request path (saveOn), so it
    never races another request for the same item — a toggle made meanwhile
    waits behind it, and a save already on the wire is joined, not repeated
    (codex review 2026-10-21). Returns false when a row could not be saved —
    the flag stays unset so the next sync retries, and the account snapshot is
    not adopted. A row the member removed meanwhile counts as handled. */
async function mergeLocalIntoServer(s: Session, live: () => boolean): Promise<boolean> {
  const rows = s.legacyMirror ? KINDS.flatMap((kind) => s.base[kind].map((id) => [kind, id] as const)) : [];
  if (rows.length > 0) {
    const results = await Promise.all(rows.map(([kind, id]) => saveOn(s, kind, id)));
    if (results.includes("failed")) return false;
  }
  if (!live()) return false; // ended or restarted meanwhile: never tag a device it no longer owns
  try {
    localStorage.setItem(MERGED_KEY, s.uid);
  } catch { /* ignore */ }
  s.legacyMirror = false; // merged: a retried sync must not upload the device copy again
  return true;
}

function endSession(s: Session) {
  // An upsert on the wire still answers its own callers; every other save
  // (queued, or waiting behind a delete) can no longer go out.
  s.waiters.forEach((_, key) => { if (s.inflight.get(key) !== true) resolveWaiters(s, key, "failed"); });
  if (s.inflight.size > 0) ended.set(s.uid, s);
}

async function startSession(uid: string) {
  if (session?.uid === uid) {
    // Same account (token refresh, focus): retry a sync that ended without the snapshot.
    resyncIfNeeded();
    return;
  }
  if (session) endSession(session);
  const mirror = mirrorFor(uid);
  const prior = ended.get(uid);
  ended.delete(uid);
  let s: Session;
  if (prior) {
    // The same account signing straight back in takes over its requests still
    // on the wire: they land in this session, and new writes queue behind them.
    // Everything else starts fresh, as for any new session.
    s = prior;
    s.base = mirror.base;
    s.known = false;
    s.desired = new Map();
    s.force = new Set();
    s.landedDuringSnapshot = null;
    s.legacyMirror = mirror.legacy;
  } else {
    s = {
      uid, base: mirror.base, known: false, desired: new Map(), inflight: new Map(), force: new Set(),
      landedDuringSnapshot: null, waiters: new Map(), legacyMirror: mirror.legacy,
    };
  }
  session = s;
  guestMirror = null;
  await sync(s);
}

/** Merge (if due) and adopt the account snapshot for `s`. Re-runnable: a sync
    that ends without the snapshot (offline, server errors) leaves known=false
    and is retried when the browser comes back online or on the account's next
    auth event (review 2026-10-21). */
async function sync(s: Session) {
  const token = ++starts;
  const live = () => session === s && starts === token;
  syncing = true;
  emit();
  try {
    if (!(await mergeLocalIntoServer(s, live)) || !live()) return; // keep the mirror view; retry next session
    s.landedDuringSnapshot = new Map();
    const server = await fetchServer(s.uid);
    if (!server || !live()) return;
    let base = server;
    s.landedDuringSnapshot.forEach((saved, key) => {
      const [kind, id] = parseKey(key);
      base = setIn(base, kind, id, saved);
    });
    s.base = base;
    s.known = true;
    // Intents the snapshot already satisfies need no request.
    s.desired.forEach((_, key) => reconcile(s, key));
  } finally {
    if (live()) {
      s.landedDuringSnapshot = null;
      syncing = false;
    }
    hydrating = false;
    emit();
  }
}

/** `clearMirror` wipes the device's copy of a signed-out account;
    `clearRequest` also drops the pre-signup heart this tab holds — only when
    a sign-in actually ended here (it belongs to that session, never to whoever
    signs in next), not when a stale mirror is swept on a guest's page load,
    where the request is the current guest's own. */
function settleAsGuest(clearMirror: boolean, clearRequest = false) {
  if (session) endSession(session);
  session = null;
  hydrating = false;
  syncing = false;
  if (clearMirror) clearLocal();
  if (clearRequest) clearPendingFavoriteReturn();
  guestMirror = null;
  emit();
}

/** Remove the signed-out account's local mirror. Called from the sign-out
    action directly, so it also covers pages where no favorites component
    happens to be mounted (the SIGNED_OUT event handler only runs if the
    store was wired). Idempotent with that handler. */
export function purgeFavoritesMirror(): void {
  settleAsGuest(true, true);
}

/** A mirror says an account was active on this device. */
function hasTaggedMirror(): boolean {
  try {
    return localStorage.getItem(MERGED_KEY) !== null || localStorage.getItem(OWNER_KEY) !== null;
  } catch {
    return false;
  }
}

function resyncIfNeeded() {
  if (session && !session.known && !syncing) void sync(session);
}

function wireAuth() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  const supabase = supabaseBrowser();
  // A server lookup started on mount must not restore an account after a
  // newer sign-in, account switch or sign-out event (same guard as
  // lib/ratings.ts and useAuthUser). INITIAL_SESSION is only a cached replay.
  let sawAuthEvent = false;
  supabase.auth.getUser().then(({ data, error }) => {
    if (sawAuthEvent) return;
    if (data.user) {
      void startSession(data.user.id);
    } else if (!session) {
      // Offline or a server hiccup is not a sign-out: wait for the next auth
      // event instead of wiping a still-signed-in account's device copy.
      if (!isDefiniteSignOut(error)) return;
      // No session, but a mirror says an account was active on this device
      // and never signed out cleanly (expired/revoked session) — purge it so
      // it can't leak to, or merge into, the next account (audit).
      settleAsGuest(hasTaggedMirror());
    }
  });
  // A sync that ended offline retries once the connection is back.
  window.addEventListener("online", resyncIfNeeded);
  supabase.auth.onAuthStateChange((event, info) => {
    if (event === "INITIAL_SESSION") {
      if (sawAuthEvent) return;
    } else {
      sawAuthEvent = true;
    }
    const nextId = info?.user?.id ?? null;
    if (event === "SIGNED_OUT" || nextId === null) {
      const signedOutHere = event === "SIGNED_OUT" && session !== null;
      // SIGNED_OUT is a definite sign-out for this device even with no session
      // live here — Supabase emits it while restoring a revoked session at
      // boot, before getUser answers — so a tagged mirror goes too. The pending
      // request stays unless a sign-in actually ended here (it may be a guest's).
      settleAsGuest(signedOutHere || (event === "SIGNED_OUT" && hasTaggedMirror()), signedOutHere);
      return;
    }
    void startSession(nextId);
  });
}

/** Toggle and return the new state (true = now saved). Guests (and taps that
    land before the session is known) save nothing: callers show the join
    sheet instead, and `saveFavorite` saves the place once they return
    signed in. */
export function toggleFavorite(kind: FavKind, id: string): boolean {
  const s = session;
  if (!s) return false;
  // The member decided about this place themselves: a pre-signup request for
  // it is moot and must never be replayed over their choice.
  if (kind === "place") retirePendingFavoriteReturn(id);
  const key = keyOf(kind, id);
  const next = !includes(load(), kind, id);
  s.desired.set(key, next);
  if (!next) {
    s.force.delete(key);
    resolveWaiters(s, key, "superseded");
  }
  emit();
  schedule(s, key);
  return next;
}

/** Whether a tap on a heart can save right now (signed in, session known). */
export function canSaveFavorites(): boolean {
  return session !== null;
}

/** The account whose favorites the store holds, or null for a guest. Callers
    acting for a signed-in user (SignupReturnNotice) check it matches, since
    useAuthUser and the store can briefly disagree (e.g. right after account
    deletion, before SIGNED_OUT reaches every subscriber). */
export function favoritesAccount(): string | null {
  return session?.uid ?? null;
}

/** Save without toggling and wait for the server's answer — used when a
    guest's pre-signup heart is honoured after they return signed in.
    "failed" means nothing is saved and the caller should keep the request
    for a retry; "superseded" means the member removed this item themselves
    meanwhile, so the request is moot. Before the account snapshot lands, a
    row the list already shows is confirmed with the server anyway: mirror
    rows may never have reached it. */
export function saveFavorite(kind: FavKind, id: string): Promise<FavoriteSaveResult> {
  const s = session;
  if (!s) return Promise.resolve("failed");
  return saveOn(s, kind, id);
}

/** A forced save of one item on session `s`, answered when its request settles. */
function saveOn(s: Session, kind: FavKind, id: string): Promise<FavoriteSaveResult> {
  const key = keyOf(kind, id);
  return new Promise((resolve) => {
    s.waiters.set(key, [...(s.waiters.get(key) ?? []), resolve]);
    if (s.inflight.get(key) === true && s.desired.get(key) !== false) return; // a save is on the wire: its answer is ours
    s.desired.set(key, true);
    s.force.add(key);
    emit();
    schedule(s, key);
  });
}

function subscribe(cb: () => void) {
  wireAuth();
  listeners.add(cb);
  // Cross-tab sync: invalidate the cache when another tab writes.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && !session) {
      guestMirror = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Live favorites map — components re-render whenever any heart toggles. */
export function useFavorites(): FavMap {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

const readyNow = () => !hydrating && !syncing;

/** False until the session check — and, when signed in, the first server
    fetch — settles. Lets the Saved tab show a loading state instead of a
    misleading "nothing saved yet" on a fresh device. */
export function useFavoritesReady(): boolean {
  return useSyncExternalStore(subscribe, readyNow, () => false);
}
