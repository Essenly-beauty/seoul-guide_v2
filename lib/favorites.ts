"use client";

// Shared favorites store — hearts stay in sync across the map sheet, place
// detail, shop, and the Saved tab.
//
// Guests: localStorage, exactly as the prototype always worked.
// Signed in: Supabase `favorites` table (RLS-scoped) is the source of truth.
//   On sign-in the local list merges INTO the account once (union), so
//   nothing a guest saved is lost; toggles write optimistically and roll
//   back if the server rejects them. Sign-out wipes the account's local
//   mirror (shared-device privacy) and returns to a fresh guest list.

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";

export type FavKind = "place" | "product" | "article";
export type FavMap = Record<FavKind, string[]>;

const KEY = "essenly.favorites";
const MERGED_KEY = "essenly.favorites.mergedFor";
const EMPTY: FavMap = { place: [], product: [], article: [] };
const KINDS: FavKind[] = ["place", "product", "article"];

let cache: FavMap | null = null;
let userId: string | null = null;
let authWired = false;
// Readiness: `hydrating` covers the initial session check; `syncing` covers a
// signed-in account's server fetch. Until both settle, the Saved tab shows a
// loading state instead of flashing "nothing saved" on a fresh device.
let hydrating = true;
let syncToken = 0;
let syncing = false;
// Latest local intent per item ("kind:id" → saved?). Toggles made while the
// account snapshot is in flight are overlaid onto it when it lands and then
// flushed to the server, so a stale fetch can never undo a visible heart.
type PendingOp = { kind: FavKind; id: string; saved: boolean; seq: number };
let opSeq = 0;
const pending = new Map<string, PendingOp>();
const listeners = new Set<() => void>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function notify() {
  listeners.forEach((l) => l());
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

function load(): FavMap {
  if (cache) return cache;
  cache = loadLocal();
  return cache;
}

function persistLocal(next: FavMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — in-memory state still works for the session
  }
}

function write(next: FavMap) {
  cache = next;
  persistLocal(next);
  notify();
}

// ── Server sync (signed-in only) ───────────────────────────

async function fetchServer(): Promise<FavMap | null> {
  const supabase = supabaseBrowser();
  // brief retry — a transient failure here would otherwise flip the Saved
  // tab to an authoritative-looking wrong (usually empty) list all session
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("favorites")
      .select("kind, item_id")
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

/** One-time per account: union the guest's local list into the server.
    Returns false when the write failed — the caller must NOT adopt the
    server list then, or the guest's unsaved merge would be wiped locally
    and the consumed flag would block every future retry. */
async function mergeLocalIntoServer(uid: string): Promise<boolean> {
  try {
    const owner = localStorage.getItem(MERGED_KEY);
    if (owner === uid) return true;
    if (owner && owner !== uid) {
      // The local list is a PREVIOUS account's mirror (A signed in here,
      // session ended without our purge running — e.g. B signs in from a
      // page where no store was mounted). Merging it into B would leak A's
      // saves into B's account (codex cross-check #3) — purge instead.
      localStorage.removeItem(KEY);
      localStorage.removeItem(MERGED_KEY);
      pending.clear();
      cache = null;
      notify();
    }
  } catch { /* proceed — worst case the upsert is a no-op */ }
  const local = loadLocal();
  const rows = KINDS.flatMap((kind) =>
    local[kind].map((item_id) => ({ user_id: uid, kind, item_id })),
  );
  if (rows.length > 0) {
    const supabase = supabaseBrowser();
    const { error } = await supabase
      .from("favorites")
      .upsert(rows, { onConflict: "user_id,kind,item_id", ignoreDuplicates: true });
    if (error) return false; // flag stays unset so the next session retries
  }
  try {
    localStorage.setItem(MERGED_KEY, uid);
  } catch { /* ignore */ }
  return true;
}

/** Re-apply local intents recorded while the server snapshot was in flight. */
function overlayPending(server: FavMap): FavMap {
  const map: FavMap = { place: [...server.place], product: [...server.product], article: [...server.article] };
  pending.forEach((op) => {
    const has = map[op.kind].includes(op.id);
    if (op.saved && !has) map[op.kind] = [op.id, ...map[op.kind]];
    if (!op.saved && has) map[op.kind] = map[op.kind].filter((x) => x !== op.id);
  });
  return map;
}

/** Send one toggle to the server; on failure roll the heart back — unless a
    newer toggle for the same item owns it now (seq mismatch). */
function sendOp(uid: string, op: PendingOp) {
  const supabase = supabaseBrowser();
  const req = op.saved
    ? supabase.from("favorites").upsert(
        { user_id: uid, kind: op.kind, item_id: op.id },
        { onConflict: "user_id,kind,item_id", ignoreDuplicates: true },
      )
    : supabase.from("favorites").delete().match({ user_id: uid, kind: op.kind, item_id: op.id });
  void req.then(({ error }) => {
    const cur = pending.get(`${op.kind}:${op.id}`);
    if (cur?.seq !== op.seq) return; // superseded — let the newer op settle it
    pending.delete(`${op.kind}:${op.id}`);
    if (error && userId === uid) {
      const list = load()[op.kind];
      write({
        ...load(),
        [op.kind]: op.saved
          ? list.filter((x) => x !== op.id)
          : list.includes(op.id) ? list : [op.id, ...list],
      });
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
      // server is the account's truth; overlay toggles made mid-fetch
      write(overlayPending(server));
      pending.forEach((op) => sendOp(uid, op)); // flush anything the server missed
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
  syncToken++; // invalidate any in-flight adopt
  if (clearMirror) {
    // the localStorage copy mirrors the signed-out account — leaving it
    // behind shows user A's saves to the next person on this device and
    // would merge them into user B's account at B's sign-in
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(MERGED_KEY);
    } catch { /* ignore */ }
    pending.clear();
  }
  if (userId !== null || clearMirror) {
    userId = null;
    cache = null; // fall back to the local (guest) list
    notify();
  } else if (changed) {
    notify();
  }
}

/** Remove the signed-out account's local mirror. Called from the sign-out
    action directly, so it also covers pages where no favorites component
    happens to be mounted (the SIGNED_OUT event handler only runs if the
    store was wired). Idempotent with that handler. */
export function purgeFavoritesMirror(): void {
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
      // No session, but MERGED_KEY says an account was active on this device
      // and never signed out cleanly (expired/revoked session) — purge its
      // mirror so it can't leak to, or merge into, the next account (audit).
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

/** Toggle and return the new state (true = now saved). */
export function toggleFavorite(kind: FavKind, id: string): boolean {
  const cur = load();
  const has = cur[kind].includes(id);
  const next: FavMap = {
    ...cur,
    [kind]: has ? cur[kind].filter((x) => x !== id) : [id, ...cur[kind]],
  };
  write(next);

  // record the intent even for guests / pre-auth taps — if a session turns
  // out to exist, adoptServerState overlays and flushes it
  const op: PendingOp = { kind, id, saved: !has, seq: ++opSeq };
  pending.set(`${kind}:${id}`, op);
  if (userId) sendOp(userId, op);
  return !has;
}

function subscribe(cb: () => void) {
  wireAuth();
  listeners.add(cb);
  // Cross-tab sync: invalidate the cache when another tab writes.
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
