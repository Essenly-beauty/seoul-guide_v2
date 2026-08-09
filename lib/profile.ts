"use client";

// Progressive-profiling store (docs/user-data-strategy.md §3–4).
//
// Guests: localStorage under "essenly.profile", following the favorites
// store pattern (module cache + listeners + useSyncExternalStore).
// Signed in: Supabase `profiles` table (one jsonb row per account, RLS).
//   On sign-in the guest's answers merge with the account's (server wins
//   per field, list fields union) so nothing answered on either side is
//   lost; every later answer writes through with a short debounce.

import { useSyncExternalStore } from "react";
import { supabaseBrowser } from "./supabase/client";
import { MAP_CATEGORIES, type PlaceType } from "./data";

export type StayType = "tourist" | "resident" | "planning";
export type AgeBand = "18-24" | "25-34" | "35-44" | "45+";
export type Gender = "female" | "male" | "other";

/** Keys of the core questions the completeness gauge counts. */
export type QuestionKey =
  | "countryCode"
  | "stayType"
  | "interests"
  | "ageBand"
  | "gender"
  | "skinType"
  | "hairType"
  | "preferredLang"
  | "budgetBand";

/** Mirrors docs §3 `profiles` columns (camelCase; snake_case when DB lands). */
export type Profile = {
  countryCode?: string; // ISO-3166 alpha-2 ("OTHER" for unlisted)
  stayType?: StayType;
  stayUntil?: string; // ISO date — tourist trip end
  interests: PlaceType[]; // T1 ② — category codes, multi-select
  ageBand?: AgeBand; // T1 ② — self-reported, optional
  gender?: Gender; // T1 ② — self-reported, optional
  skinType?: string;
  skinConcerns: string[];
  hairType?: string;
  hairConcerns: string[];
  preferredLang?: string;
  budgetBand?: string;
  /** Context-trigger queue — question to surface first (docs §4-2). */
  priorityKey?: QuestionKey;
};

export type QuestionOption = { value: string; label: string };
export type Question = {
  key: QuestionKey;
  title: string;
  /** "왜 묻나요" — value-back caption shown with the question (docs §1-2). */
  why: string;
  options: QuestionOption[];
  /** Multi-select (interests) — answered once at least one value is set. */
  multi?: boolean;
};

/** Interest options — PlaceType codes with the map-category labels (docs §3). */
export const INTEREST_OPTIONS = MAP_CATEGORIES.filter((c) => c.key !== "all") as { key: PlaceType; label: string }[];

/** Ordered question list — nextQuestion() walks this top to bottom. */
export const QUESTIONS: Question[] = [
  {
    key: "countryCode",
    title: "Where are you visiting from?",
    why: "Sets currency hints, tax-refund tips, and popular picks from home.",
    options: [
      { value: "US", label: "United States" },
      { value: "JP", label: "Japan" },
      { value: "CN", label: "China" },
      { value: "TW", label: "Taiwan" },
      { value: "TH", label: "Thailand" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    key: "stayType",
    title: "How long are you in Seoul?",
    why: "Tunes the map radius and picks between trip deals and local spots.",
    options: [
      { value: "tourist", label: "Traveling now" },
      { value: "resident", label: "Living here" },
      { value: "planning", label: "Planning a trip" },
    ],
  },
  {
    key: "interests",
    title: "What are you into?",
    why: "Presets your map categories and ranking picks.",
    options: INTEREST_OPTIONS.map((c) => ({ value: c.key, label: c.label })),
    multi: true,
  },
  {
    key: "ageBand",
    title: "Your age range? (optional)",
    why: "Sharpens trend and deal picks for your group.",
    options: [
      { value: "18-24", label: "18–24" },
      { value: "25-34", label: "25–34" },
      { value: "35-44", label: "35–44" },
      { value: "45+", label: "45+" },
    ],
  },
  {
    key: "gender",
    title: "How do you identify? (optional)",
    why: "Some clinics and salons tailor menus by gender.",
    options: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "other", label: "Other" },
    ],
  },
  {
    key: "skinType",
    title: "What's your skin type?",
    why: "Ranks clinics and products that match your skin first.",
    options: [
      { value: "dry", label: "Dry" },
      { value: "oily", label: "Oily" },
      { value: "combo", label: "Combo" },
      { value: "sensitive", label: "Sensitive" },
    ],
  },
  {
    key: "hairType",
    title: "What's your hair type?",
    why: "Helps salons quote the right treatment and time.",
    options: [
      { value: "straight", label: "Straight" },
      { value: "wavy", label: "Wavy" },
      { value: "curly", label: "Curly" },
    ],
  },
  {
    key: "preferredLang",
    title: "Preferred language for visits?",
    why: "Highlights places with staff who speak your language.",
    options: [
      { value: "en", label: "English" },
      { value: "ja", label: "日本語" },
      { value: "zh", label: "中文" },
      { value: "ko", label: "한국어" },
    ],
  },
  {
    key: "budgetBand",
    title: "Usual budget per visit?",
    why: "Filters menus and deals to your comfortable range.",
    options: [
      { value: "₩", label: "₩ Budget" },
      { value: "₩₩", label: "₩₩ Mid" },
      { value: "₩₩₩", label: "₩₩₩ Premium" },
    ],
  },
];

const KEY = "essenly.profile";
const EMPTY: Profile = { interests: [], skinConcerns: [], hairConcerns: [] };

let cache: Profile | null = null;
let userId: string | null = null;
let authWired = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const QUESTION_KEYS = QUESTIONS.map((q) => q.key);
const INTEREST_KEYS = INTEREST_OPTIONS.map((c) => c.key);

function isQuestionKey(v: unknown): v is QuestionKey {
  return typeof v === "string" && (QUESTION_KEYS as string[]).includes(v);
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

/** Validate an untrusted payload (localStorage or server jsonb) field by field. */
function sanitize(p: Partial<Profile>): Profile {
  return {
    countryCode: str(p.countryCode),
    stayType: oneOf(p.stayType, ["tourist", "resident", "planning"]),
    stayUntil: str(p.stayUntil),
    interests: strList(p.interests).filter((x): x is PlaceType => (INTEREST_KEYS as string[]).includes(x)),
    ageBand: oneOf(p.ageBand, ["18-24", "25-34", "35-44", "45+"]),
    gender: oneOf(p.gender, ["female", "male", "other"]),
    skinType: str(p.skinType),
    skinConcerns: strList(p.skinConcerns),
    hairType: str(p.hairType),
    hairConcerns: strList(p.hairConcerns),
    preferredLang: str(p.preferredLang),
    budgetBand: str(p.budgetBand),
    priorityKey: isQuestionKey(p.priorityKey) ? p.priorityKey : undefined,
  };
}

function load(): Profile {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = sanitize(JSON.parse(raw) as Partial<Profile>);
      return cache;
    }
  } catch {
    // fall through to empty
  }
  cache = { ...EMPTY };
  return cache;
}

function write(next: Profile) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable — in-memory state still works for the session
  }
  listeners.forEach((l) => l());
}

// ── Server sync (signed-in only) ───────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SCALAR_KEYS = [
  "countryCode", "stayType", "stayUntil", "ageBand", "gender",
  "skinType", "hairType", "preferredLang", "budgetBand", "priorityKey",
] as const;
const LIST_KEYS = ["interests", "skinConcerns", "hairConcerns"] as const;

// Fields the user changed locally that no push has confirmed yet — they win
// over server values in every merge, so an in-flight fetch can't revert a
// tap the UI already acknowledged.
let dirty = new Set<string>();
// Last known server payload. Pushes are blocked until we have one — a failed
// first fetch must never lead to blindly overwriting the account's row.
let serverSnap: Profile | null = null;

/** Server wins per answered field, lists union — except fields in
    `localWins` (unconfirmed local edits), where local wins wholesale. */
function mergeProfiles(local: Profile, server: Profile, localWins: Set<string>): Profile {
  const merged: Profile = { ...local };
  for (const k of SCALAR_KEYS) {
    if (!localWins.has(k) && server[k]) (merged as Record<string, unknown>)[k] = server[k];
  }
  for (const k of LIST_KEYS) {
    (merged as unknown as Record<string, string[]>)[k] = localWins.has(k)
      ? [...local[k]]
      : Array.from(new Set([...server[k], ...local[k]]));
  }
  return merged;
}

const val = (p: Profile, k: string) => JSON.stringify((p as Record<string, unknown>)[k] ?? null);

/** Read-merge-write push: re-fetch the row (unless flushing at unload),
    overlay local dirty fields, upsert. Keeps a laptop's stale mirror from
    erasing answers the same account saved on a phone in the meantime. */
async function pushNow(uid: string, refetch: boolean) {
  const supabase = supabaseBrowser();
  const before = load();
  const keys = new Set(dirty);
  let server = serverSnap;
  if (refetch) {
    const { data, error } = await supabase.from("profiles").select("data").eq("user_id", uid).maybeSingle();
    if (!error) server = data ? sanitize((data.data ?? {}) as Partial<Profile>) : { ...EMPTY };
  }
  if (userId !== uid) return;
  if (server === null) return; // never fetched this account — writing blind could erase its answers
  const merged = mergeProfiles(load(), server, keys);
  const { error } = await supabase.from("profiles").upsert({ user_id: uid, data: merged }, { onConflict: "user_id" });
  if (userId !== uid) return;
  if (error) {
    schedulePush(5000); // keep `dirty`; one delayed retry, then next edit/flush retries
    return;
  }
  serverSnap = merged;
  // confirm only fields unchanged since capture — a mid-flight edit stays dirty
  const after = load();
  keys.forEach((k) => {
    if (val(before, k) === val(after, k)) dirty.delete(k);
  });
  if (cache === before && JSON.stringify(merged) !== JSON.stringify(after)) {
    write(merged); // surface newer answers this fetch brought from other devices
  }
}

/** Debounced whole-profile push — answers often come in quick taps. */
function schedulePush(delay = 600) {
  if (!userId) return;
  const uid = userId;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow(uid, true);
  }, delay);
}

/** Fire a pending push immediately (tab hidden/closing) — no refetch, merge
    against the cached snapshot so the request races the unload. */
function flushPush() {
  if (!pushTimer || !userId) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  void pushNow(userId, false);
}

async function adoptServerProfile(uid: string) {
  const supabase = supabaseBrowser();
  let row: { data: unknown } | null = null;
  let fetched = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from("profiles").select("data").eq("user_id", uid).maybeSingle();
    if (!error) {
      row = data;
      fetched = true;
      break;
    }
    await sleep(700 * (attempt + 1));
  }
  // on total failure serverSnap stays null: pushes remain blocked and dirty
  // fields are preserved until a later load fetches the row successfully
  if (!fetched || userId !== uid) return;
  if (!row) {
    // first sign-in on this account: the guest's answers become the account's
    const local = load();
    const { error } = await supabase.from("profiles").upsert({ user_id: uid, data: local }, { onConflict: "user_id" });
    if (!error && userId === uid) serverSnap = local;
    return;
  }
  const server = sanitize((row.data ?? {}) as Partial<Profile>);
  serverSnap = server;
  const merged = mergeProfiles(load(), server, dirty);
  if (JSON.stringify(merged) !== JSON.stringify(load())) write(merged);
  if (JSON.stringify(merged) !== JSON.stringify(server)) {
    const { error } = await supabase.from("profiles").upsert({ user_id: uid, data: merged }, { onConflict: "user_id" });
    if (!error && userId === uid) serverSnap = merged;
  }
}

/** Remove the signed-out account's local mirror. Called from the sign-out
    action directly, so it also covers pages where no profile component
    happens to be mounted. Idempotent with the SIGNED_OUT handler below. */
export function purgeProfileMirror(): void {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  userId = null;
  serverSnap = null;
  dirty = new Set();
  cache = null;
  listeners.forEach((l) => l());
}

function wireAuth() {
  if (authWired || typeof window === "undefined") return;
  authWired = true;
  // best-effort flush of a pending debounced answer when the tab goes away
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPush();
  });
  window.addEventListener("pagehide", flushPush);
  const supabase = supabaseBrowser();
  supabase.auth.getUser().then(({ data }) => {
    if (data.user && userId !== data.user.id) {
      userId = data.user.id;
      void adoptServerProfile(data.user.id);
    }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    const nextId = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || nextId === null) {
      const hadUser = userId !== null;
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      if (event === "SIGNED_OUT" && hadUser) {
        // the local copy mirrors the signed-out account — leaving it behind
        // would expose user A's demographics to the next person on this
        // device and merge them into user B's account at B's sign-in
        try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      }
      if (hadUser) {
        userId = null;
        serverSnap = null;
        dirty = new Set();
        cache = null; // fall back to the local (guest) view
        listeners.forEach((l) => l());
      }
      return;
    }
    if (nextId !== userId) {
      userId = nextId;
      void adoptServerProfile(nextId);
    }
  });
}

/** Merge a partial update into the stored profile. */
export function updateProfile(patch: Partial<Profile>): void {
  write({ ...load(), ...patch });
  Object.keys(patch).forEach((k) => dirty.add(k));
  schedulePush();
}

/** One-tap answer from a question card (typed wrapper over updateProfile).
    For the multi-select `interests` key the value is toggled in the list. */
export function answerQuestion(key: QuestionKey, value: string): void {
  if (key === "interests") {
    const cur = load().interests;
    const v = value as PlaceType;
    updateProfile({ interests: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
    return;
  }
  updateProfile({ [key]: value } as Partial<Profile>);
}

/**
 * Context-trigger queue (docs §4-2): flag a category question to surface first
 * on the My page. No-op once that field is answered.
 */
export function queuePriorityQuestion(key: QuestionKey): void {
  const cur = load();
  if (isAnswered(cur, key) || cur.priorityKey === key) return;
  write({ ...cur, priorityKey: key });
  dirty.add("priorityKey");
  schedulePush();
}

export function isAnswered(p: Profile, key: QuestionKey): boolean {
  if (key === "interests") return p.interests.length > 0; // multi — ≥1 counts
  const v = p[key];
  return typeof v === "string" && v.length > 0;
}

/** 0–100 across the core fields (docs §2 completeness gauge).
    Counts all 9 QUESTIONS keys — budgetBand included — so the gauge hits 100
    exactly when nextQuestion() runs out (chose 9 over the 8-field variant to
    keep the gauge and the question card consistent). */
export function profileCompleteness(p: Profile): number {
  const answered = QUESTION_KEYS.filter((k) => isAnswered(p, k)).length;
  return Math.round((answered / QUESTION_KEYS.length) * 100);
}

/** Question descriptor for a key (QUESTIONS covers every QuestionKey). */
export function questionFor(key: QuestionKey): Question {
  return QUESTIONS.find((q) => q.key === key) as Question;
}

/**
 * First unanswered question, priority-queued key first (if still unanswered).
 * Returns null when the profile is complete.
 */
export function nextQuestion(p: Profile): Question | null {
  if (p.priorityKey && !isAnswered(p, p.priorityKey)) {
    const q = QUESTIONS.find((x) => x.key === p.priorityKey);
    if (q) return q;
  }
  return QUESTIONS.find((q) => !isAnswered(p, q.key)) ?? null;
}

function subscribe(cb: () => void) {
  wireAuth();
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

/** Live profile — components re-render on any answer/queue change. */
export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}
