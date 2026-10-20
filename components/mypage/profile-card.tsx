"use client";

// My page profile-completeness card (docs/user-data-strategy.md §4-1):
// gauge + one question at a time with 1-tap chip answers; each question shows
// a "why we ask" caption. All answered → compact incentive row.

import { useLocale } from "@/lib/i18n/locale-provider";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { routes } from "@/lib/routes";
import { answerQuestion, nextQuestion, profileCompleteness, useProfile } from "@/lib/profile";

export function ProfileCard() {
  const { t } = useLocale();
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
        href={routes.map}
        style={{
          ...shell,
          gap: 12,
          padding: "12px 14px",
          // Soft diagonal brand tint — gives the passing glint a surface to catch.
          background: "linear-gradient(135deg, var(--accent-soft-2), var(--surface-hover) 55%, var(--accent-soft))",
        }}
      >
        {/* codex cross-check #1: the "passport 10% deal" was fabricated —
            reward completion with what's actually true (tuned picks). */}
        <span style={{ fontSize: 20 }} aria-hidden="true">✨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14 }}>{t("Profile complete · Picks tuned to you")}</b>
          <div className="t-caption">{t("Your map and rankings now match your beauty profile")}</div>
        </div>
        <Icon name="chev" size="xs" style={{ color: "var(--dim)", flex: "none" }} />
      </Link>
    );
  }

  return (
    <section className="stack sm" style={{ ...shell, padding: "12px 14px", gap: 8 }} aria-label={t("Profile completeness")}>
      <div className="row" style={{ gap: 10 }}>
        <b className="t-label-md" style={{ fontSize: 14, flex: "none" }}>{t("Profile completeness")}</b>
        <span className="t-label-sm" style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>{pct}%</span>
      </div>
      <div className="rbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} style={{ flex: "none", background: "var(--border)" }}>
        <i style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
      <div className="t-caption">{t("Answers make recommendations smarter.")}</div>
      <div style={{ marginTop: 2 }}>
        <b style={{ fontSize: 14, display: "block" }}>{t(q.title)}</b>
        <div className="t-caption">{t("Why we ask")} · {t(q.why)}</div>
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
              toast(t("Saved — thanks!"));
            }}
          >
            {o.label}
          </Chip>
        ))}
      </div>
    </section>
  );
}
