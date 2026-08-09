"use client";

import { useState, type ReactNode } from "react";
import { BackButton } from "@/components/ui/back-button";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { AppleGlyph, GoogleGlyph, KakaoGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

type SocialProvider = "google" | "apple" | "kakao";

/** Chrome shared by Sign in and Register (Figma 58:1295 / 58:1319):
    back + lockup, title, support line, the caller's form, then real social
    OAuth via Supabase. Providers not yet configured in the Supabase
    dashboard surface the provider error inline instead of failing silently. */
export function AuthShell({ title, support, children, foot }: {
  title: string;
  support?: ReactNode;
  children: ReactNode;
  foot: ReactNode;
}) {
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);

  const signInWith = async (provider: SocialProvider) => {
    if (socialBusy) return; // review: repeated taps fired parallel OAuth flows
    setSocialError(null);
    setSocialBusy(provider);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/map` },
    });
    if (error) {
      setSocialBusy(null);
      setSocialError(
        `${provider[0].toUpperCase()}${provider.slice(1)} sign-in isn't available yet — use email for now.`,
      );
    }
    // On success the browser navigates away to the provider.
  };

  return (
    <div className="auth-screen app-scroll">
      <div className="auth-top">
        <BackButton fallback={routes.welcome} />
        <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
          <BrandMark size={30} />
          <BrandWordmark size={11} />
        </div>
        <span aria-hidden="true" />
      </div>

      <h1 className="auth-title">{title}</h1>
      {support && <p className="auth-support">{support}</p>}

      {children}

      <div className="auth-or">or</div>
      <div className="auth-socials" style={socialBusy ? { opacity: 0.55, pointerEvents: "none" } : undefined}>
        <button type="button" className="auth-social" aria-label="Continue with Google" aria-busy={socialBusy === "google"} disabled={!!socialBusy} onClick={() => signInWith("google")}><GoogleGlyph /></button>
        <button type="button" className="auth-social" aria-label="Continue with Apple" aria-busy={socialBusy === "apple"} disabled={!!socialBusy} onClick={() => signInWith("apple")}><AppleGlyph /></button>
        <button type="button" className="auth-social" aria-label="Continue with Kakao" aria-busy={socialBusy === "kakao"} disabled={!!socialBusy} style={{ background: "#fee500" }} onClick={() => signInWith("kakao")}><KakaoGlyph /></button>
      </div>
      {socialError && (
        <p className="auth-error" role="alert">{socialError}</p>
      )}

      <p className="auth-foot">{foot}</p>
    </div>
  );
}
