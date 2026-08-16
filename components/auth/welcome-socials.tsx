"use client";

// Labeled social sign-in on the welcome screen — the primary funnel
// (user decision 2026-08-16: push signup/social first, guest is an escape
// hatch). Google is live; Apple degrades to the same "not yet" notice the
// auth pages use until the Developer Program lands.

import { useState } from "react";
import { AppleGlyph, GoogleGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";

type SocialProvider = "google" | "apple";

export function WelcomeSocials() {
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInWith = async (provider: SocialProvider) => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/map` },
    });
    if (err) {
      setBusy(null);
      setError(`${provider === "google" ? "Google" : "Apple"} sign-in isn't available yet — use email for now.`);
    }
    // on success the browser navigates to the provider
  };

  return (
    <div className="stack sm" style={{ width: "100%" }}>
      <button
        type="button"
        className="welcome-social welcome-social-google"
        aria-busy={busy === "google"}
        disabled={!!busy}
        onClick={() => signInWith("google")}
      >
        <GoogleGlyph />
        <span>Continue with Google</span>
      </button>
      <button
        type="button"
        className="welcome-social welcome-social-apple"
        aria-busy={busy === "apple"}
        disabled={!!busy}
        onClick={() => signInWith("apple")}
      >
        <AppleGlyph />
        <span>Continue with Apple</span>
      </button>
      {error && <p className="auth-error" role="alert" style={{ marginTop: 2 }}>{error}</p>}
    </div>
  );
}
