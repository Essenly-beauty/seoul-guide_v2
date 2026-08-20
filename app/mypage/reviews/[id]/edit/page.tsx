"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { CategoryBadge } from "@/components/category/category-badge";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TopBar } from "@/components/ui/top-bar";
import { getPlace } from "@/lib/data";
import {
  REVIEW_MAX_LEN,
  canEditMyReview,
  setReview,
  useMyRatings,
  useMyRatingsReady,
} from "@/lib/ratings";
import { routes } from "@/lib/routes";

export default function ReviewEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const reviews = useMyRatings();
  const ready = useMyRatingsReady();
  const review = reviews[id];
  const place = getPlace(id);
  const [rating, setRating] = useState(0);
  const [draft, setDraft] = useState("");
  const [postPublic, setPostPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const initializedReviewId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !review || initializedReviewId.current === id) return;
    initializedReviewId.current = id;
    setRating(review.rating);
    setDraft(review.body ?? "");
    setPostPublic(review.body ? review.isPublic === true : true);
  }, [id, ready, review]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !canEditMyReview(review) || rating < 1 || !draft.trim()) return;
    setSaving(true);
    setSaveError("");
    const saved = await setReview(id, rating, draft, postPublic);
    setSaving(false);
    if (!saved) {
      setSaveError("Couldn’t save your review. Your draft is still here — please try again.");
      return;
    }
    router.replace(routes.review(id));
  };

  const editing = Boolean(review?.body);

  return (
    <>
      <TopBar
        center
        left={<BackButton fallback={routes.review(id)} />}
        title={editing ? "Edit review" : "Add review"}
      />
      <div className="app-scroll pad pagev2 review-composer-page">
        {!ready ? (
          <div role="status" aria-busy="true" className="review-detail-loading">
            Loading your review…
          </div>
        ) : !place || !canEditMyReview(review) ? (
          <section className="stack sm">
            <EmptyState>Rate this place before adding a review.</EmptyState>
            <Button variant="secondary" href={place ? routes.place(id) : routes.reviews}>
              {place ? "View place" : "Back to My reviews"}
            </Button>
          </section>
        ) : (
          <form className="review-composer-form" onSubmit={save}>
            <section className="review-composer-place" aria-label="Place being reviewed">
              <CategoryBadge type={place.type} size={20} />
              <span>
                <b>{place.name}</b>
                <span className="t-caption mono">{place.nameKr}</span>
              </span>
            </section>

            <fieldset className="review-composer-rating">
              <legend>Your rating</legend>
              <div className="review-composer-stars" role="group" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={value <= rating ? "selected" : ""}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    aria-pressed={value === rating}
                    onClick={() => setRating(value)}
                  >
                    {value <= rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="review-composer-copy">
              <span>
                <b>{editing ? "Update your review" : "What should other travelers know?"}</b>
                <span className="t-caption">Useful details make your rating more meaningful.</span>
              </span>
              <textarea
                className="input"
                aria-label="Your review"
                placeholder="What stood out? Add a tip for the next visitor."
                rows={7}
                maxLength={REVIEW_MAX_LEN}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <span className="review-composer-count num" aria-live="polite">
                {draft.length}/{REVIEW_MAX_LEN}
              </span>
            </label>

            <label className="review-composer-consent">
              <input
                type="checkbox"
                checked={postPublic}
                onChange={(event) => setPostPublic(event.target.checked)}
              />
              <span>
                <b>Post publicly</b>
                <span className="t-caption">
                  Travelers see this review with your first name. Uncheck to keep it private.
                </span>
              </span>
            </label>

            <div className="review-composer-actions">
              <Button
                variant="secondary"
                onClick={() => router.push(routes.review(id))}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || rating < 1 || !draft.trim()}>
                {saving ? "Saving…" : "Save review"}
              </Button>
            </div>
            {saveError && <p role="alert" className="auth-error">{saveError}</p>}
          </form>
        )}
      </div>
    </>
  );
}
