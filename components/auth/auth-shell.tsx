"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { BrandWordmark } from "@/components/brand/brand-logo";
import { GoogleGlyph } from "@/components/brand/auth-glyphs";
import { Icon } from "@/components/icon";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";
import { oauthCallbackUrl } from "@/lib/auth-return";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./auth.module.css";

type SocialProvider = "google";

export function AuthShell({ title, support, children, cta, foot, oauthNext }: {
  title: string; support?: ReactNode; children: ReactNode; cta?: ReactNode; foot?: ReactNode; oauthNext?: string;
}) {
  const { t } = useLocale();
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (socialError) errorRef.current?.focus(); }, [socialError]);

  const signInWith = async (provider: SocialProvider) => {
    if (socialBusy) return;
    setSocialError(null);
    setSocialBusy(provider);
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider, options: { redirectTo: oauthCallbackUrl(window.location.origin, oauthNext) },
      });
      if (error) {
        setSocialBusy(null);
        setSocialError("Google sign-in is unavailable right now. Please use email or try again.");
      }
    } catch {
      setSocialBusy(null);
      setSocialError("Unable to connect. Check your connection and try again.");
    }
  };

  return <main className={`auth-screen app-scroll ${styles.screen}`}>
    <div className="auth-top">
      <BackButton fallback={routes.welcome} />
      <BrandWordmark size={13} />
      <Link className={styles.language} href={routes.settingsLanguage} aria-label={t("Language")}><Icon name="languages" size="sm" /></Link>
    </div>
    <header className={styles.heading}>
      <h1 className="auth-title">{t(title)}</h1>
      {support && <p className="auth-support">{typeof support === "string" ? t(support) : support}</p>}
    </header>
    {children}
    <div className="auth-or">{t("or")}</div>
    <button type="button" className={styles.google} aria-busy={socialBusy === "google"} disabled={!!socialBusy} onClick={() => signInWith("google")}>
      <GoogleGlyph /><span>{t(socialBusy ? "Connecting…" : "Continue with Google")}</span>
    </button>
    {socialError && <p ref={errorRef} tabIndex={-1} className="auth-error" role="alert">{t(socialError)}</p>}
    {cta}
    {foot && <p className="auth-foot">{foot}</p>}
  </main>;
}
