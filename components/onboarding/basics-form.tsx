"use client";

// The only post-signup screen. It stores the two high-signal answers now and
// leaves all detailed beauty preferences to the My tab's progressive profile.

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { routes } from "@/lib/routes";
import { INTEREST_OPTIONS, answerQuestion, questionFor, useProfile } from "@/lib/profile";

function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return routes.map;
  return raw;
}

export function BasicsForm({ next }: { next?: string }) {
  const router = useRouter();
  const profile = useProfile();
  const stay = questionFor("stayType");
  const nextTarget = safeNext(next);

  const finish = () => {
    router.push(nextTarget);
    router.refresh();
  };

  return (
    <div className="stack">
      <div>
        <div className="label">OPTIONAL · ABOUT 20 SECONDS</div>
        <div className="h1">
          Make it<br />
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>yours.</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>We’ll use this to put the most useful Seoul picks first.</p>
      </div>

      <div>
        <div className="label">{stay.title}</div>
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

      <div>
        <div className="label">What are you interested in?</div>
        <div className="chipwrap" style={{ marginTop: 8 }}>
          {INTEREST_OPTIONS.map((interest) => (
            <Chip
              key={interest.key}
              selected={profile.interests.includes(interest.key)}
              onClick={() => answerQuestion("interests", interest.key)}
            >
              {interest.label}
            </Chip>
          ))}
        </div>
      </div>

      <Button onClick={finish} style={{ marginTop: 4 }}>
        Personalize my Seoul Drop
      </Button>
      <button type="button" className="caption muted" onClick={finish} style={{ textAlign: "center", textDecoration: "underline" }}>
        Skip
      </button>
    </div>
  );
}
