"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";
import { authLinkWithNext, safeAuthNext } from "@/lib/auth-return";
import { useLocale } from "@/lib/i18n/locale-provider";
import styles from "./auth.module.css";

const CALLBACK_ERRORS: Record<string, string> = {
  auth: "That sign-in link didn't work — sign in with your password instead.",
  expired: "That link has expired — sign in, or request a fresh one.",
  browser: "That link was opened in a different browser, so it couldn't finish — your email may already be confirmed. Try signing in with your password.",
};

function SignInForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = safeAuthNext(searchParams.get("next")) ?? routes.map;
  const [reveal, setReveal] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    return code ? (Object.prototype.hasOwnProperty.call(CALLBACK_ERRORS, code) ? CALLBACK_ERRORS[code] : CALLBACK_ERRORS.auth) : null;
  });

  // Clear callback errors from the address, preserving the user's destination.
  useEffect(() => {
    if (searchParams.get("error")) {
      const params = new URLSearchParams();
      const next = searchParams.get("next");
      if (next) params.set("next", next);
      if (searchParams.get("switch") === "1") params.set("switch", "1");
      router.replace(params.size ? `${routes.signIn}?${params}` : routes.signIn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setUnconfirmed(false);
    setResendNote(null);
    try {
      const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: id.trim(), password: pw });
      if (err) {
        const isUnconfirmed = err.message === "Email not confirmed";
        setUnconfirmed(isUnconfirmed);
        setError(err.message === "Invalid login credentials"
          ? "Email or password doesn't match — please try again."
          : isUnconfirmed ? "Please confirm your email first — check your inbox for our link." : err.message);
        setBusy(false);
        return;
      }
      router.push(nextTarget);
      router.refresh();
    } catch {
      setError("Unable to connect. Check your connection and try again.");
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (resendBusy || resendIn > 0 || !id.trim()) return;
    setResendBusy(true);
    setResendNote(null);
    try {
      const { error: err } = await supabaseBrowser().auth.resend({
        type: "signup", email: id.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}` },
      });
      if (err) {
        setResendNote(err.message.toLowerCase().includes("rate limit")
          ? "Too many emails — please wait a minute before trying again."
          : "We couldn't send another link right now. Please try again shortly.");
        return;
      }
      setResendNote("Confirmation email sent again — check spam too.");
      setResendIn(60);
    } catch {
      setResendNote("Unable to connect. Check your connection and try again.");
    } finally { setResendBusy(false); }
  };

  return (
    <form onSubmit={submit} className={styles.form} aria-busy={busy}>
      <div className="auth-fields">
        <div className={styles.fieldGroup}>
          <label htmlFor="signin-email">{t("Email")}</label>
          <input id="signin-email" name="email" className="auth-field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            placeholder={t("Enter email")} aria-invalid={!!error} aria-describedby={error ? "signin-error" : undefined} required value={id} onChange={(event) => setId(event.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="signin-password">{t("Password")}</label>
          <div className="auth-field-wrap">
            <input id="signin-password" name="password" className={`auth-field ${styles.passwordField}`} type={reveal ? "text" : "password"} autoComplete="current-password"
              placeholder={t("Password")} aria-invalid={!!error} aria-describedby={error ? "signin-error" : undefined} required value={pw} onChange={(event) => setPw(event.target.value)} />
            <button type="button" className="auth-field-toggle" aria-label={t(reveal ? "Hide password" : "Show password")} aria-pressed={reveal} onClick={() => setReveal((value) => !value)}><EyeGlyph off={!reveal} /></button>
          </div>
        </div>
      </div>
      <Link className="auth-aside" href={authLinkWithNext(routes.forgotPassword, nextTarget)}>{t("Forgot password?")}</Link>
      {error && <p ref={errorRef} tabIndex={-1} id="signin-error" className="auth-error" role="alert">{t(error)}</p>}
      {unconfirmed && <div className={styles.resend}>
        <button type="button" className="auth-cta-secondary" disabled={resendBusy || resendIn > 0} onClick={resendConfirmation}>
          {resendBusy ? t("Sending…") : resendIn > 0 ? t("Resend available in {seconds}s", { seconds: resendIn }) : t("Resend confirmation email")}
        </button>
        {resendNote && <p className="auth-support" role="status">{t(resendNote)}</p>}
      </div>}
      <button className="auth-cta" type="submit" disabled={busy}>{t(busy ? "Signing in…" : "Sign in")}</button>
    </form>
  );
}

function RegisterCta() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const next = safeAuthNext(searchParams.get("next"));
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (searchParams.get("switch") === "1") params.set("switch", "1");
  const query = params.toString();
  return <div className={styles.register}>
    <span>{t("Not a member yet?")}</span>
    <Link className="auth-link" href={query ? `${routes.register}?${query}` : routes.register}>{t("Create an account")}</Link>
  </div>;
}

export function LoginClient({ next }: { next?: string }) {
  const { t } = useLocale();
  return <AuthShell title="Sign in" oauthNext={next}
    support={t("Sign in to keep your saved places with you.")}
    cta={<Suspense fallback={null}><RegisterCta /></Suspense>}
    foot={<Link className="auth-link" href={routes.support}>{t("Need help?")}</Link>}>
    <Suspense fallback={null}><SignInForm /></Suspense>
  </AuthShell>;
}
