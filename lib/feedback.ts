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

function saveQueue(entries: FeedbackEntry[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable — nothing else we can do client-side
  }
}

async function insertEntries(entries: FeedbackEntry[]): Promise<boolean> {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getUser();
  const rows = entries.map((e) => ({
    user_id: data.user?.id ?? null,
    category: e.category,
    message: e.message.slice(0, 2000),
    contact_ok: e.contactOk,
    page: e.page.slice(0, 300),
  }));
  const { error } = await supabase.from("feedback").insert(rows);
  return !error;
}

/** Send one feedback note (plus any queued from earlier failures).
    Resolves true when it reached the server, false when it was queued. */
export async function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
  contactOk: boolean;
  page: string;
}): Promise<boolean> {
  const entry: FeedbackEntry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...input,
  };
  const batch = [...loadQueue(), entry];
  const sent = await insertEntries(batch).catch(() => false);
  saveQueue(sent ? [] : batch);
  return sent;
}
