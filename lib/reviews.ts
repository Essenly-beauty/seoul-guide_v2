"use client";

// Public traveler reviews — read model + reporting (리뷰 공개 전환, 2026-08-16).
// Reads go through the masked `public_reviews` view (no user ids, first
// name only, hidden rows excluded). Reports are write-only; 3 distinct
// reporters auto-hide a review server-side.

import { supabaseBrowser } from "@/lib/supabase/client";

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  at: string;
  displayName: string;
  mine: boolean;
};

export const REPORT_REASONS = [
  { key: "spam", label: "Spam or ad" },
  { key: "offensive", label: "Offensive" },
  { key: "off_topic", label: "Not about this place" },
  { key: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

/** Compact relative timestamp for review rows ("just now" … "3y ago"). */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Newest public reviews for a place; [] on any failure (view missing, offline). */
export async function fetchPlaceReviews(placeId: string, limit = 10): Promise<PublicReview[]> {
  try {
    const { data, error } = await supabaseBrowser()
      .from("public_reviews")
      .select("id, rating, body, updated_at, display_name, mine")
      .eq("place_id", placeId)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<{ id: string; rating: number; body: string; updated_at: string; display_name: string; mine: boolean }>).map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      at: r.updated_at,
      displayName: r.display_name,
      mine: r.mine === true,
    }));
  } catch {
    return [];
  }
}

/** Report a public review. "already" when this account reported it before. */
export async function reportReview(ratingId: string, reason: ReportReason): Promise<"reported" | "already" | "failed"> {
  try {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getUser();
    const reporter = data.user?.id;
    if (!reporter) return "failed";
    const { error } = await supabase.from("review_reports").insert({ rating_id: ratingId, reporter, reason });
    if (!error) return "reported";
    return error.code === "23505" ? "already" : "failed";
  } catch {
    return "failed";
  }
}
