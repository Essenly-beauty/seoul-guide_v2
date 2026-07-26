"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/lib/routes";

const STAR_LABELS = ["Poor", "Fair", "Good", "Great", "Amazing"];

export default function WriteReviewPage() {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const canSubmit = stars > 0;

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.reviews} />} title="Write a review" />
      <main className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <p className="t-caption mono num">Eden Head Spa · Apr 22</p>
          <SectionHeader title="How was your visit?" />
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
            <span className="t-label-md muted" style={{ alignSelf: "center", marginLeft: 6 }}>
              {stars ? STAR_LABELS[stars - 1] : "Tap to rate"}
            </span>
          </div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="What did you get?" />
          <ChipGroup ariaLabel="Services received" items={["Scalp diagnosis", "Head spa", "Aroma massage", "Hair treatment", "Styling"]} />
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Your review" />
          <textarea
            id="review-text"
            className="input"
            rows={5}
            aria-label="Your review"
            placeholder="What should other travelers know? English menus, communication, results…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={800}
          />
          <div className="t-caption num" style={{ color: "var(--dim)", textAlign: "right" }}>{text.length}/800</div>
        </section>

        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title="Photos" />
          <button type="button" className="card" style={{ display: "grid", placeItems: "center", minHeight: 84, borderStyle: "dashed" }} onClick={() => toast("Photo upload arrives with the full release")}>
            <span className="row" style={{ gap: 6, color: "var(--muted)" }}><Icon name="plus" size="sm" /> Add photos · Optional</span>
          </button>
        </section>

        <Button
          disabled={!canSubmit}
          aria-describedby={!canSubmit ? "review-submit-help" : undefined}
          style={!canSubmit ? { opacity: 0.5 } : undefined}
          onClick={() => { toast("Review submitted — thank you!"); router.push(routes.reviews); }}
        >
          Submit review
        </Button>
        {!canSubmit && <p id="review-submit-help" className="t-caption" style={{ color: "var(--dim)", textAlign: "center" }}>Add a star rating to submit.</p>}
      </main>
    </>
  );
}
