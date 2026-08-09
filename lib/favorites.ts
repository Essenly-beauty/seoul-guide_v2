"use client";

// Shared favorites store — hearts stay in sync across the map sheet, place
// detail, shop, and the Saved tab.
//
// Guests: localStorage, exactly as the prototype always worked.
// Signed in: Supabase `favorites` table (RLS-scoped) is the source of truth.
//   On sign-in the local list merges INTO the account once (union), so
//   nothing a guest saved is lost; toggles write optimistically and roll
//   back if the server rejects them. Sign-out returns to the local list.

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";
import { ARTICLES } from "./data";

export type FavKind = "place" | "product" | "article";
export type FavMap = Record<FavKind, string[]>;

const KEY = "essenly.favorites";
const MERGED_KEY = "essenly.favorites.mergedFor";
const SEED: FavMap = {
  place: ["oy-gangnam-town", "juno-hair-gangnam", "colorlab-gangnam", "soothe-head-spa"],
  product: ["cosrx-snail-mucin", "anua-heartleaf-toner", "boj-glow-serum"],
  article: ARTICLES.slice(0, 2).map((a) => a.slug),
};
const EMPTY: FavMap = { place: [], product: [], article: [] };
const KINDS: FavKind[] = ["place", "product", "article"];

let cache: FavMap | null = null;
let userId: string | null = null;
let authWired = false;
const listeners = new Set<() => void>();

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
    // fall through to seed
  }
  return SEED;
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
  const { data, error } = await supabase
    .from("favorites")
    .select("kind, item_id")
    .order("created_at", { ascending: false });
  if (error) return null;
  const map: FavMap = { place: [], product: [], article: [] };
  for (const row of data ?? []) {
    if (KINDS.includes(row.kind as FavKind)) map[row.kind as FavKind].push(row.item_id);
  }
  return map;
}

/** One-time per account: union the guest's local list into the server. */
async function mergeLocalIntoServer(uid: string) {
  try {
    if (localStorage.getItem(MERGED_KEY) === uid) return;
  } catch { /* proceed — worst case the upsert is a no-op */ }
  const local = loadLocal();
  const rows = KINDS.flatMap((kind) =>
    local[kind].map((item_id) => ({ user_id: uid, kind, item_id })),
  );
  if (rows.length > 0) {
    const supabase = supabaseBrowser();
    await supabase.from("favorites").upsert(rows, { onConflict: "user_id,kind,item_id", ignoreDuplicates: true });
  }
  try {
    localStorage.setItem(MERGED_KEY, uid);
  } catch { /* ignore */ }
}

async function adoptServerState(uid: string) {
  await mergeLocalIntoServer(uid);
  const server = await fetchServer();
  if (server && userId === uid) {
    // server is the account's truth; mirror locally for fast next paint
    write(server);
  }
}

function wireAuth() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  const supabase = supabaseBrowser();
  supabase.auth.getUser().then(({ data }) => {
    if (data.user && userId !== data.user.id) {
      userId = data.user.id;
      void adoptServerState(data.user.id);
    }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const nextId = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || nextId === null) {
      if (userId !== null) {
        userId = null;
        cache = null; // fall back to the local (guest) list
        notify();
      }
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

  if (userId) {
    const uid = userId;
    const supabase = supabaseBrowser();
    const op = has
      ? supabase.from("favorites").delete().match({ user_id: uid, kind, item_id: id })
      : supabase.from("favorites").upsert(
          { user_id: uid, kind, item_id: id },
          { onConflict: "user_id,kind,item_id", ignoreDuplicates: true },
        );
    void op.then(({ error }) => {
      if (error && userId === uid) {
        // roll back the optimistic flip so the heart reflects reality
        write({
          ...load(),
          [kind]: has ? [id, ...load()[kind]] : load()[kind].filter((x) => x !== id),
        });
      }
    });
  }
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
