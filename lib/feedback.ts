"use client";

// Feedback channel store (docs/user-data-strategy.md §5).
// Append-only mirror of the `feedback` table in a DB-ready shape, persisted to
// localStorage under "essenly.feedback" (same guarded pattern as favorites).
// When Supabase lands, submitFeedback becomes an insert — shape stays put.

export type FeedbackCategory = "bug" | "idea" | "place" | "other";

/** Mirrors docs §3 `feedback` columns (camelCase; snake_case when DB lands). */
export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  /** Route the sheet was opened from (auto-attached). */
  page: string;
  contactOk: boolean;
  createdAt: number; // epoch ms (Date.now in the submit handler)
};

const KEY = "essenly.feedback";

function loadAll(): FeedbackEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as FeedbackEntry[];
    }
  } catch {
    // fall through to empty
  }
  return [];
}

/** Append one feedback note; returns the stored entry. */
export function submitFeedback(input: {
  category: FeedbackCategory;
  message: string;
  contactOk: boolean;
  page: string;
}): FeedbackEntry {
  const entry: FeedbackEntry = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...input,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([...loadAll(), entry]));
  } catch {
    // storage unavailable — drop silently; the toast still thanks the user
  }
  return entry;
}
