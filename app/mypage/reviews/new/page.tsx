"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/lib/routes";

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Amazing"];

export default function WriteReviewPage() {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.reviews} />} title="Write a review" />
      <main className="app-scroll pad stack">
        <div>
          <div className="label">Eden Head Spa · Apr 22</div>
          <h1 className="h1">How was your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>visit?</span></h1>
        </div>

        <div role="radiogroup" aria-label="Rating" className="row" style={{ gap: 4 }}>
          {STAR_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={stars === i + 1}
              aria-label={`${i + 1} star${i ? "s" : ""} — ${label}`}
              tabIndex={stars === i + 1 || (stars === 0 && i === 0) ? 0 : -1}
              onClick={() => setStars(i + 1)}
              onKeyDown={(e) => {
                let next: number | null = null;
                if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(i + 2, 5);
                if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(i, 1);
                if (next !== null) {
                  e.preventDefault();
                  setStars(next);
                  const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=radio]");
                  btns?.[next - 1]?.focus();
                }
              }}
              style={{ width: 44, height: 44, fontSize: 26, color: i < stars ? "var(--warning)" : "var(--border)" }}
            >
              ★
            </button>
          ))}
          <span className="small muted" style={{ alignSelf: "center", marginLeft: 6 }}>
            {stars ? STAR_LABELS[stars - 1] : "Tap to rate"}
          </span>
        </div>

        <div className="label">What did you get?</div>
        <ChipGroup items={["Scalp diagnosis", "Head spa", "Aroma massage", "Hair treatment", "Styling"]} />

        <div className="field">
          <label htmlFor="review-text">Your review</label>
          <textarea
            id="review-text"
            className="input"
            rows={5}
            placeholder="What should other travelers know? English menus, communication, results…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={800}
          />
          <div className="caption dim" style={{ textAlign: "right" }}>{text.length}/800</div>
        </div>

        <div className="label">Photos · Optional</div>
        <button type="button" className="card" style={{ display: "grid", placeItems: "center", minHeight: 84, borderStyle: "dashed" }} onClick={() => toast("Photo upload arrives with the full release")}>
          <span className="row" style={{ gap: 6, color: "var(--muted)" }}><Icon name="plus" size="sm" /> Add photos</span>
        </button>

        <button
          type="button"
          className="btn"
          disabled={stars === 0}
          style={stars === 0 ? { opacity: 0.5 } : undefined}
          onClick={() => { toast("Review submitted — thank you!"); router.push(routes.reviews); }}
        >
          Submit review
        </button>
        {stars === 0 && <p className="caption dim" style={{ textAlign: "center" }}>Add a star rating to submit.</p>}
      </main>
    </>
  );
}
