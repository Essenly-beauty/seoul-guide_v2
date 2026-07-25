"use client";

// T1 screen ② (docs/user-data-strategy.md §2): interest categories
// (PlaceType codes, multi-select — zero is fine) + self-reported age band and
// gender, both visibly optional. Taps write straight to the profile store.

import Link from "next/link";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { INTEREST_OPTIONS, answerQuestion, questionFor, useProfile } from "@/lib/profile";

const INTEREST_SUBTITLES: Partial<Record<string, string>> = {
  olive_young: "K-beauty hauls, drugstore picks",
  skin_clinic: "Facials, non-surgical treatments",
  hair_salon: "K-pop styles, color, treatments",
  nail_lash: "Nail art, lash extensions",
  personal_color: "Color analysis sessions",
  head_spa: "Scalp care, relaxation",
  etc: "Saunas, photo studios & more",
};

export function InterestsForm() {
  const profile = useProfile();
  const age = questionFor("ageBand");
  const gender = questionFor("gender");

  return (
    <div className="stack">
      <div>
        <div className="label">Step 2 · Interests</div>
        <div className="h1">
          What brings you<br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>to Seoul?</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>Pick any — it presets your map and rankings.</p>
      </div>

      <div className="label">I&apos;m interested in</div>
      {INTEREST_OPTIONS.map((it) => {
        const on = profile.interests.includes(it.key);
        return (
          <button key={it.key} className="pickcard" aria-pressed={on} onClick={() => answerQuestion("interests", it.key)}>
            <CategoryBadge type={it.key} size={26} />
            <div><b>{it.label}</b><div className="caption muted">{INTEREST_SUBTITLES[it.key]}</div></div>
            <span className="chk"><Icon name="check" size="xs" /></span>
          </button>
        );
      })}

      <div>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <div className="label">Age range</div>
          <span className="t-caption" style={{ marginLeft: "auto" }}>Optional · skip freely</span>
        </div>
        <div className="t-caption" style={{ marginTop: 2 }}>Why we ask · {age.why}</div>
        <div className="chipwrap" style={{ marginTop: 8 }}>
          {age.options.map((o) => {
            const on = profile.ageBand === o.value;
            return (
              <button key={o.value} className={"chip" + (on ? " selected" : "")} aria-pressed={on} onClick={() => answerQuestion("ageBand", o.value)}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
          <div className="label">Gender</div>
          <span className="t-caption" style={{ marginLeft: "auto" }}>Optional · skip freely</span>
        </div>
        <div className="t-caption" style={{ marginTop: 2 }}>Why we ask · {gender.why}</div>
        <div className="chipwrap" style={{ marginTop: 8 }}>
          {gender.options.map((o) => {
            const on = profile.gender === o.value;
            return (
              <button key={o.value} className={"chip" + (on ? " selected" : "")} aria-pressed={on} onClick={() => answerQuestion("gender", o.value)}>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {profile.interests.includes("skin_clinic") && (
        <div className="banner warning">
          <Icon name="cross" size="sm" />
          <span>Medical procedures in Korea require a pre-visit consultation. We&apos;ll share details after you sign up.</span>
        </div>
      )}

      <Link className="btn" href={routes.onboardingProfile} style={{ marginTop: 4 }}>
        Next <Icon name="chev" size="sm" />
      </Link>
      <Link className="caption muted" href={routes.onboardingProfile} style={{ textAlign: "center", textDecoration: "underline" }}>
        Skip for now
      </Link>
    </div>
  );
}
