"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";

const COUNTRIES = [
  "United States", "Japan", "China", "Taiwan", "Thailand", "Vietnam", "Philippines", "Indonesia",
  "Malaysia", "Singapore", "India", "United Kingdom", "Germany", "France", "Canada", "Australia",
  "Russia", "Brazil", "Mexico", "Saudi Arabia", "UAE", "Turkey", "Italy", "Spain", "Netherlands",
  "Sweden", "Switzerland", "New Zealand", "Hong Kong", "Mongolia",
];

const INTERESTS: { key: string; label: string; subtitle: string; icon: IconName }[] = [
  { key: "shopping", label: "K-Beauty Shopping", subtitle: "Olive Young, Cosmetic Hauls", icon: "bag" },
  { key: "salon", label: "Hair Salon", subtitle: "K-pop styles, Color, Treatments", icon: "scissors" },
  { key: "spa", label: "Spa & Wellness", subtitle: "Head spa, Foot care, Massage", icon: "spa" },
  { key: "clinic", label: "Skin Clinic", subtitle: "Facials, Non-surgical treatments", icon: "cross" },
  { key: "spots", label: "Hip Spots", subtitle: "Cafes, Photo spots, Hidden gems", icon: "pin" },
];

const EXPERIENCE = [
  { key: "first_time", label: "First time", subtitle: "Curious to try" },
  { key: "know_a_bit", label: "Know a bit", subtitle: "Tried a few products" },
  { key: "obsessed", label: "Obsessed", subtitle: "Daily K-beauty user" },
];

export function InterestsForm() {
  const [country, setCountry] = useState("");
  const [interests, setInterests] = useState<Set<string>>(new Set(["shopping"]));
  const [exp, setExp] = useState<string | null>(null);

  function toggleInterest(key: string) {
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // can't deselect the last one
        next.delete(key);
      } else next.add(key);
      return next;
    });
  }

  const canNext = country !== "" && interests.size >= 1;

  return (
    <div className="stack">
      <div>
        <div className="label">Step 1 · Interests</div>
        <div className="h1">
          What brings you<br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>to Seoul?</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>Complete your profile to get personalized picks.</p>
      </div>

      <div className="field">
        <label>Your country</label>
        <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Select your country</option>
          {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          <option>Other</option>
        </select>
      </div>

      <div className="label">I&apos;m interested in</div>
      {INTERESTS.map((it) => {
        const on = interests.has(it.key);
        return (
          <button key={it.key} className="pickcard" aria-pressed={on} onClick={() => toggleInterest(it.key)}>
            <span className="ic"><Icon name={it.icon} /></span>
            <div><b>{it.label}</b><div className="caption muted">{it.subtitle}</div></div>
            <span className="chk"><Icon name="check" size="xs" /></span>
          </button>
        );
      })}

      <div className="label">How well do you know K-Beauty?</div>
      <div className="chipwrap">
        {EXPERIENCE.map((e) => {
          const on = exp === e.key;
          return (
            <button key={e.key} className={"chip" + (on ? " selected" : "")} aria-pressed={on} onClick={() => setExp(on ? null : e.key)}>
              {e.label}
            </button>
          );
        })}
      </div>

      {interests.has("clinic") && (
        <div className="banner warning">
          <Icon name="cross" size="sm" />
          <span>Medical procedures in Korea require a pre-visit consultation. We&apos;ll share details after you sign up.</span>
        </div>
      )}

      {canNext ? (
        <Link className="btn" href={routes.onboardingProfile} style={{ marginTop: 4 }}>Next <Icon name="chev" size="sm" /></Link>
      ) : (
        <button className="btn" style={{ marginTop: 4, opacity: 0.5 }} disabled>Next <Icon name="chev" size="sm" /></button>
      )}
    </div>
  );
}
