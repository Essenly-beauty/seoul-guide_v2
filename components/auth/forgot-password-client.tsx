"use client";

// Real password recovery (review finding: the old "Recovery password" link
// dead-ended at the FAQ). Sends a reset email; the link lands on
// /auth/callback, explicitly targeting /reset-password after PKCE exchange.

import { useLocale } from "@/lib/i18n/locale-provider";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";
import { authLinkWithNext, oauthCallbackUrl, passwordResetDestination } from "@/lib/auth-return";

export function ForgotPasswordClient({ next }: { next?: string }) {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: oauthCallbackUrl(window.location.origin, passwordResetDestination(next)),
    });
    setBusy(false);
    if (err) {
      setError(err.message.includes("rate limit")
        ? "Too many attempts — please wait a minute and try again."
        : err.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset password"
      oauthNext={next}
      support={sent
        ? t("If an account exists for {email}, a reset link is on its way.", { email: email.trim() })
        : t("Enter your account email and we'll send a reset link.")}
      foot={<>{t("Remembered it?")} <Link className="auth-link" href={authLinkWithNext(routes.signIn, next)}>{t("Sign in")}</Link></>}
    >
      {sent ? (
        <p className="auth-support" style={{ marginTop: 28, lineHeight: 1.6 }}>
          {t("Open the link on this device to choose a new password. Check spam, or try again in a minute.")}
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: "contents" }}>
          <div className="auth-fields">
            <input
              className="auth-field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={t("Enter email")}
              aria-label={t("Email")}
              aria-invalid={!!error}
              aria-describedby={error ? "forgot-error" : undefined}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p id="forgot-error" className="auth-error" role="alert">{t(error)}</p>}
          <button className="auth-cta" type="submit" disabled={busy}>
            {t(busy ? "Sending…" : "Send reset link")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
