"use client";

// The join prompt — one shared signup funnel sheet (user decision
// 2026-08-16: the welcome gateway is gone; everyone lands on the map and
// the account is sold contextually). Guests meet it on the My tab, on
// place-detail views, and on account-value actions (heart, rating, saved
// layer). Always dismissible: the guest action itself has already
// completed locally, so "Continue as guest" never loses anything.
//
// Frequency by context:
//  - menu, favorite, rating, savedLayer: every time (deliberate,
//    account-value moments)
//  - detail: once per session (it's the core browsing loop — a prompt per
//    view would kill discovery)

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { GoogleGlyph } from "@/components/brand/auth-glyphs";
import { useAuthUser } from "@/lib/auth/use-auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

export type NudgeContext = "favorite" | "rating" | "savedLayer" | "menu" | "detail";

const COPY: Record<NudgeContext, { title: string; body: string }> = {
  favorite: {
    title: "Save it to your account",
    body: "This heart lives only on this device. Join and your saved places follow you — any phone, safely backed up.",
  },
  rating: {
    title: "Keep your ratings",
    body: "Join and your ratings and review notes stay on your account across devices.",
  },
  savedLayer: {
    title: "Your saved-places layer",
    body: "Tap ♥ on any place to collect it here. Join and the collection follows your account.",
  },
  menu: {
    title: "Make MYSEOULDROP yours",
    body: "Saved places, ratings, and your beauty profile sync to your account — free, takes a minute.",
  },
  detail: {
    title: "Planning to visit?",
    body: "Join to save places like this, rate your visits, and keep everything across devices.",
  },
};

const SESSION_KEY = (c: NudgeContext) => `essenly.nudge.session.${c}`;

export function useSigninNudge(): { nudge: (c: NudgeContext) => void; sheet: ReactNode } {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<NudgeContext | null>(null);
  const [busy, setBusy] = useState(false);

  const nudge = useCallback(
    (c: NudgeContext) => {
      if (loading || user) return; // members never see it
      if (c === "detail") {
        try {
          if (sessionStorage.getItem(SESSION_KEY(c))) return;
          sessionStorage.setItem(SESSION_KEY(c), "1");
        } catch { /* storage unavailable — still show */ }
      }
      setCtx(c);
    },
    [loading, user],
  );

  const google = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}` },
    });
    if (error) setBusy(false); // fall through to the email options below
  };

  const nextParam = `?next=${encodeURIComponent(pathname)}`;
  const sheet = ctx ? (
    <BottomSheet title={COPY[ctx].title} kicker="MYSEOULDROP account" onClose={() => setCtx(null)}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{COPY[ctx].body}</p>
      <div className="stack sm" style={{ marginTop: 16 }}>
        <button type="button" className="welcome-social welcome-social-google" disabled={busy} aria-busy={busy} onClick={google}>
          <GoogleGlyph />
          <span>Continue with Google</span>
        </button>
        <Button href={`${routes.register}${nextParam}`}>Sign up with email</Button>
        <p className="caption muted" style={{ textAlign: "center", margin: "2px 0 0" }}>
          <Link className="auth-link" href={`${routes.signIn}${nextParam}`}>Sign in</Link>
          <span className="dim" aria-hidden="true"> · </span>
          <button className="auth-link" style={{ font: "inherit" }} onClick={() => setCtx(null)}>Continue as guest</button>
        </p>
      </div>
    </BottomSheet>
  ) : null;

  return { nudge, sheet };
}
