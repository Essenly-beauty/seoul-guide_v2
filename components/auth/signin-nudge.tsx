"use client";

// The join prompt — one shared signup funnel sheet (user decision
// 2026-08-16: the welcome gateway is gone; everyone lands on the map and
// the account is sold contextually). Visitors meet it on the My tab, on
// place-detail views, and on account-value actions (heart, rating, saved
// layer). Always dismissible: the visitor action itself has already
// completed locally, so "Keep exploring" never loses anything.
//
// Frequency by context:
//  - menu, favorite, rating, savedLayer: every time (deliberate,
//    account-value moments). Detail views stay prompt-free — the ask
//    happens on Save, not on looking (user decision 2026-08-16).

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { GoogleGlyph } from "@/components/brand/auth-glyphs";
import { useAuthUser } from "@/lib/auth/use-auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";
import { setPendingFavoriteReturn } from "@/lib/signup-return";

export type NudgeContext = "favorite" | "rating" | "savedLayer" | "menu" | "shareList";
type SavedPlace = { id: string; name: string };
type NudgeOptions = { savedPlace?: SavedPlace };
type ActiveNudge = { context: NudgeContext; savedPlace?: SavedPlace };

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
    title: "Keep your Seoul list",
    body: "Explore freely. Sign in when you want saved places, ratings, and your beauty profile to follow you across devices.",
  },
  shareList: {
    title: "Share your list with a link",
    body: "Join and your saved places become a link — friends open it right on the map.",
  },
};

export function useSigninNudge(): { nudge: (c: NudgeContext, options?: NudgeOptions) => void; sheet: ReactNode } {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveNudge | null>(null);
  const [busy, setBusy] = useState(false);
  // `usePathname` is intentionally used instead of reading `window.location`
  // during render so the server and hydrated sheet agree on the redirect.
  const returnTo = pathname || routes.map;
  const onboardingTarget = `${routes.onboardingBasics}?next=${encodeURIComponent(returnTo)}`;

  const nudge = useCallback(
    (context: NudgeContext, options: NudgeOptions = {}) => {
      if (loading || user) return; // members never see it
      setActive({ context, savedPlace: options.savedPlace });
    },
    [loading, user],
  );

  const rememberSavedPlace = () => {
    if (active?.savedPlace) {
      setPendingFavoriteReturn({ placeId: active.savedPlace.id, placeName: active.savedPlace.name });
    }
  };

  const google = async () => {
    if (busy) return;
    setBusy(true);
    rememberSavedPlace();
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(onboardingTarget)}` },
    });
    if (error) setBusy(false); // fall through to the email options below
  };

  const signInParam = `?next=${encodeURIComponent(returnTo)}`;
  const registerParam = `?next=${encodeURIComponent(onboardingTarget)}`;
  const sheet = active ? (
    <BottomSheet title={COPY[active.context].title} kicker="MYSEOULDROP account" onClose={() => setActive(null)}>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{COPY[active.context].body}</p>
      <div className="stack sm" style={{ marginTop: 16 }}>
        <button type="button" className="welcome-social welcome-social-google" disabled={busy} aria-busy={busy} onClick={google}>
          <GoogleGlyph />
          <span>Continue with Google</span>
        </button>
        <Button href={`${routes.register}${registerParam}`} onClick={rememberSavedPlace}>Sign up with email</Button>
        <p className="caption muted" style={{ textAlign: "center", margin: "2px 0 0" }}>
          <Link className="auth-link" href={`${routes.signIn}${signInParam}`}>Sign in</Link>
          <span className="dim" aria-hidden="true"> · </span>
          <button className="auth-link" style={{ font: "inherit" }} onClick={() => setActive(null)}>Keep exploring</button>
        </p>
      </div>
    </BottomSheet>
  ) : null;

  return { nudge, sheet };
}
