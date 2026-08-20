"use client";

import { useParams } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TopBar } from "@/components/ui/top-bar";
import { CategoryBadge } from "@/components/category/category-badge";
import { getPlace } from "@/lib/data";
import { canEditMyReview, useMyRatings, useMyRatingsReady } from "@/lib/ratings";
import { routes } from "@/lib/routes";

function formatReviewDate(at?: string): string {
  if (!at) return "Date unavailable";
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export default function MyReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ratings = useMyRatings();
  const ready = useMyRatingsReady();
  const review = ratings[id];
  const place = getPlace(id);

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.reviews} />} title="My review" />
      <div className="app-scroll pad stack pagev2 review-detail-page">
        {!ready ? (
          <div role="status" aria-busy="true" className="review-detail-loading">Loading your review…</div>
        ) : !place || !review ? (
          <section className="stack sm">
            <EmptyState>This review is no longer available in your account.</EmptyState>
            <Button variant="secondary" href={routes.reviews}>Back to My reviews</Button>
          </section>
        ) : (
          <>
            <section className="review-detail-place">
              <div className="row" style={{ gap: 8 }}>
                <CategoryBadge type={place.type} size={18} />
                <span className="label">{place.type.replaceAll("_", " ")} · {place.zone}</span>
              </div>
              <h1>{place.name}</h1>
              <p className="t-caption mono">{place.nameKr}</p>
            </section>

            <section className="review-detail-summary" aria-label="Review summary">
              <div className="review-detail-score" aria-label={`${review.rating} out of 5 stars`}>
                <strong>{review.rating}</strong>
                <span>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              </div>
              <div className="review-detail-status">
                <b>{review.body ? review.isPublic ? "Public review" : "Private note" : "Rating only"}</b>
                <span className="t-caption">Updated {formatReviewDate(review.at)}</span>
              </div>
            </section>

            <section className="review-detail-body stack sm">
              <div className="label">Your review</div>
              {review.body ? (
                <p>{review.body}</p>
              ) : (
                <div className="review-detail-empty">
                  <b>Add the details behind your rating</b>
                  <p>Share what stood out, or keep a private note for your next visit.</p>
                </div>
              )}
            </section>

            <div className="review-detail-actions">
              {canEditMyReview(review) && (
                <Button href={routes.reviewEdit(id)}>
                  {review.body ? "Edit review" : "Add a review"}
                </Button>
              )}
              <Button variant="secondary" href={routes.place(id)}>View place</Button>
            </div>
          </>
        )}
      </div>
      <BottomNav active="menu" />
    </>
  );
}
