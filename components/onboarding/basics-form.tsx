"use client";

// T1 screen ① (docs/user-data-strategy.md §2): country + Seoul stay type.
// All tap-select and skippable; every tap writes straight to the profile
// store, so leaving mid-way still keeps whatever was answered.

import Link from "next/link";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { routes } from "@/lib/routes";
import { answerQuestion, questionFor, useProfile } from "@/lib/profile";

export function BasicsForm() {
  const profile = useProfile();
  const country = questionFor("countryCode");
  const stay = questionFor("stayType");

  return (
    <div className="stack">
      <div>
        <div className="label">Step 1 · Your trip</div>
        <div className="h1">
          Where are you<br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>joining us from?</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>Two taps — everything here is optional.</p>
      </div>

      <div>
        <div className="label">{country.title}</div>
        <div className="t-caption" style={{ marginTop: 2 }}>Why we ask · {country.why}</div>
        <div className="chipwrap" style={{ marginTop: 8 }}>
          {country.options.map((o) => {
            const on = profile.countryCode === o.value;
            return (
              <Chip key={o.value} selected={on} onClick={() => answerQuestion("countryCode", o.value)}>
                {o.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <div>
        <div className="label">{stay.title}</div>
        <div className="t-caption" style={{ marginTop: 2 }}>Why we ask · {stay.why}</div>
        <div className="chipwrap" style={{ marginTop: 8 }}>
          {stay.options.map((o) => {
            const on = profile.stayType === o.value;
            return (
              <Chip key={o.value} selected={on} onClick={() => answerQuestion("stayType", o.value)}>
                {o.label}
              </Chip>
            );
          })}
        </div>
      </div>

      <Button href={routes.onboardingInterests} style={{ marginTop: 4 }}>
        Next <Icon name="chev" size="sm" />
      </Button>
      <Link className="caption muted" href={routes.onboardingInterests} style={{ textAlign: "center", textDecoration: "underline" }}>
        Skip for now
      </Link>
    </div>
  );
}
