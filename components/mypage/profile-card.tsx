"use client";

// My page profile-completeness card (docs/user-data-strategy.md §4-1):
// gauge + one question at a time with 1-tap chip answers; each question shows
// a "why we ask" caption. All answered → compact incentive row.

import Link from "next/link";
import { Icon } from "@/components/icon";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/lib/routes";
import { answerQuestion, nextQuestion, profileCompleteness, useProfile } from "@/lib/profile";

export function ProfileCard() {
  const { toast } = useToast();
  const profile = useProfile();
  const pct = profileCompleteness(profile);
  const q = nextQuestion(profile);

  // Borderless fill container — matches the detail-page event banner (§4.6 Home-③).
  const shell = { background: "var(--surface-hover)", borderRadius: 12 } as const;

  if (!q) {
    return (
      <Link
        className="row deal-sheen"
        href={routes.place("dragon-hill-spa")}
        style={{
          ...shell,
          gap: 12,
          padding: "12px 14px",
          // Soft diagonal brand tint — gives the passing glint a surface to catch.
          background: "linear-gradient(135deg, var(--accent-soft-2), var(--surface-hover) 55%, var(--accent-soft))",
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden="true">🎟</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>Profile complete · Welcome deal unlocked</b>
          <div className="t-caption">Show your passport — 10% off your first visit</div>
        </div>
        <Icon name="chev" size="xs" style={{ color: "var(--dim)", flex: "none" }} />
      </Link>
    );
  }

  return (
    <section className="stack sm" style={{ ...shell, padding: "12px 14px", gap: 8 }} aria-label="Profile completeness">
      <div className="row" style={{ gap: 10 }}>
        <b className="t-label-md" style={{ fontSize: 14, flex: "none" }}>Profile completeness</b>
        <span className="t-label-sm" style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>{pct}%</span>
      </div>
      <div className="rbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ flex: "none", background: "var(--border)" }}>
        <i style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
      <div className="t-caption">Answers make recommendations smarter.</div>
      <div style={{ marginTop: 2 }}>
        <b style={{ fontSize: 14, display: "block" }}>{q.title}</b>
        <div className="t-caption">Why we ask · {q.why}</div>
      </div>
      {/* Single-tap chips. For the multi-select interests question one tap is
          treated as "answered" (≥1 interest) and the card advances — the full
          multi-select lives in onboarding step 2; more can be added there. */}
      <div className="chipwrap">
        {q.options.map((o) => (
          <Chip
            key={o.value}
            onClick={() => {
              answerQuestion(q.key, o.value);
              toast("Saved — thanks!");
            }}
          >
            {o.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}
