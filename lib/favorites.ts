"use client";

// Shared favorites store — hearts stay in sync across the map sheet, place
// detail, shop, and the Saved tab. Persisted to localStorage, seeded with the
// prototype's original mock list on first run.

import { useSyncExternalStore } from "react";
import { ARTICLES } from "./data";

export type FavKind = "place" | "product" | "article";
export type FavMap = Record<FavKind, string[]>;

const KEY = "essenly.favorites";
const SEED: FavMap = {
  place: ["oy-gangnam-town", "juno-hair-gangnam", "colorlab-gangnam", "soothe-head-spa"],
  product: ["cosrx-snail-mucin", "anua-heartleaf-toner", "boj-glow-serum"],
  article: ARTICLES.slice(0, 2).map((a) => a.slug),
};
const EMPTY: FavMap = { place: [], product: [], article: [] };

let cache: FavMap | null = null;
const listeners = new Set<() => void>();

function load(): FavMap {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FavMap>;
      cache = {
        place: Array.isArray(parsed.place) ? parsed.place : [],
        product: Array.isArray(parsed.product) ? parsed.product : [],
        article: Array.isArray(parsed.article) ? parsed.article : [],
      };
      return cache;
    }
  } catch {
    // fall through to seed
  }
  cache = SEED;
  return cache;
}

function write(next: FavMap) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — in-memory state still works for the session
  }
  listeners.forEach((l) => l());
}

/** Toggle and return the new state (true = now saved). */
export function toggleFavorite(kind: FavKind, id: string): boolean {
  const cur = load();
  const has = cur[kind].includes(id);
  write({ ...cur, [kind]: has ? cur[kind].filter((x) => x !== id) : [id, ...cur[kind]] });
  return !has;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: invalidate the cache when another tab writes.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
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
