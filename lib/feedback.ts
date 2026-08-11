"use client";

// Feedback channel — real submissions into the Supabase `feedback` table
// (insert-only via RLS; the team reads with the service role). If the
// network write fails the note is queued in localStorage and retried on the
// next submit, so nothing is lost — and the UI can say so honestly instead
// of thanking the user for a note that went nowhere (launch audit P0-3).

import { supabaseBrowser } from "./supabase/client";

export type FeedbackCategory = "bug" | "idea" | "place" | "other";

export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  /** Route the sheet was opened from (auto-attached). */
  page: string;
  contactOk: boolean;
  createdAt: number; // epoch ms (Date.now in the submit handler)
  /** Who wrote it, captured at write time — a queued note is never later
      attributed to whichever different user happens to be signed in. */
  userId: string | null;
};

const QUEUE_KEY = "essenly.feedback"; // same key the prototype used — old
// entries left in it are treated as unsent and flushed on the next submit

function loadQueue(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as FeedbackEntry[];
    }
  } catch {
    // fall through to empty
  }
  return [];
}

/** Persist and VERIFY (read back) — private mode/quota can silently drop
    the write, and we must not tell the user "saved" when it wasn't. */
function saveQueue(entries: FeedbackEntry[]): boolean {
  try {
    const payload = JSON.stringify(entries);
    localStorage.setItem(QUEUE_KEY, payload);
    return localStorage.getItem(QUEUE_KEY) === payload;
  } catch {
    return false;
  }
}

async function insertEntries(entries: FeedbackEntry[], currentUid: string | null): Promise<boolean> {
  const supabase = supabaseBrowser();
  const rows = entries.map((e) => ({
    // RLS only allows null or the caller's own uid — a note queued under a
    // different (or unknown) account goes through anonymously
    user_id: e.userId && e.userId === currentUid ? e.userId : null,
    category: e.category,
    message: e.message.slice(0, 2000),
    contact_ok: e.contactOk,
    page: e.page.slice(0, 300),
  }));
  const { error } = await supabase.from("feedback").insert(rows);
  return !error;
}

export type FeedbackResult = "sent" | "queued" | "lost";

/** Send one feedback note (plus any queued from earlier failures). */
export async function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
  contactOk: boolean;
  page: string;
}): Promise<FeedbackResult> {
  const supabase = supabaseBrowser();
  const uid = await supabase.auth.getUser().then(({ data }) => data.user?.id ?? null).catch(() => null);
  const entry: FeedbackEntry = {
    ...input,
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    userId: uid,
  };
  // legacy queue entries predate userId — treat them as anonymous
  const batch = [...loadQueue().map((e) => ({ ...e, userId: e.userId ?? null })), entry];
  const sent = await insertEntries(batch, uid).catch(() => false);
  if (sent) {
    saveQueue([]);
    return "sent";
  }
  return saveQueue(batch) ? "queued" : "lost";
}
