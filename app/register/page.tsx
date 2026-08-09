"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

const RESEND_COOLDOWN_S = 60;

export default function RegisterPage() {
  const router = useRouter();
  const [reveal, setReveal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const cooldownRef = useRef<number | null>(null);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => () => { if (cooldownRef.current) window.clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setResendIn(RESEND_COOLDOWN_S);
    if (cooldownRef.current) window.clearInterval(cooldownRef.current);
    cooldownRef.current = window.setInterval(() => {
      setResendIn((s) => {
        if (s <= 1 && cooldownRef.current) window.clearInterval(cooldownRef.current);
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(routes.onboardingMode)}`,
      },
    });
    if (err) {
      setBusy(false);
      setError(
        err.message.includes("at least 6 characters")
          ? "Password needs at least 6 characters."
          : err.message,
      );
      return;
    }
    // Anti-enumeration: an already-registered confirmed email "succeeds" with
    // an identity-less user and NO email is sent — don't promise one (review).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setBusy(false);
      setError("This email already has an account — sign in instead, or reset your password.");
      return;
    }
    if (data.session) {
      // Email confirmation disabled — signed in right away.
      router.push(routes.onboardingMode);
      router.refresh();
      return;
    }
    setBusy(false);
    setSentTo(form.email.trim());
    startCooldown();
  };

  const resend = async () => {
    if (!sentTo || resendIn > 0) return;
    setResendNote(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(routes.onboardingMode)}`,
      },
    });
    if (err) {
      setResendNote(err.message.toLowerCase().includes("rate limit")
        ? "Too many emails — please wait a minute before trying again."
        : err.message);
      return;
    }
    setResendNote("Sent again — give it a minute and check spam too.");
    startCooldown();
  };

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        support={<>We sent a confirmation link to <b style={{ color: "var(--text)" }}>{sentTo}</b></>}
        foot={<>Wrong address? <button className="auth-link" onClick={() => { setSentTo(null); setResendNote(null); }}>Try again</button></>}
      >
        <p className="auth-support" style={{ marginTop: 28, lineHeight: 1.6 }}>
          Tap the link in the email to activate your account.
          For the smoothest ride, open it on this device.
        </p>
        <button
          type="button"
          className="auth-cta"
          style={{ marginTop: 26 }}
          disabled={resendIn > 0}
          onClick={resend}
        >
          {resendIn > 0 ? `Resend available in ${resendIn}s` : "Resend email"}
        </button>
        {resendNote && <p className="auth-support" role="status" style={{ marginTop: 14 }}>{resendNote}</p>}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Register"
      support={<>If you need any support <Link className="auth-link" href={routes.support}>click here</Link></>}
      foot={<>Do you have an account? <Link className="auth-link" href={routes.signIn}>Sign in</Link></>}
    >
      <form onSubmit={submit} style={{ display: "contents" }}>
        <div className="auth-fields">
          <input
            className="auth-field"
            autoComplete="name"
            placeholder="Full name"
            aria-label="Full name"
            required
            value={form.name}
            onChange={set("name")}
          />
          <input
            className="auth-field"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter email"
            aria-label="Email"
            aria-invalid={!!error}
            aria-describedby={error ? "register-error" : undefined}
            required
            value={form.email}
            onChange={set("email")}
          />
          <div className="auth-field-wrap">
            <input
              className="auth-field"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Password"
              aria-label="Password"
              aria-invalid={!!error}
              aria-describedby={error ? "register-error" : undefined}
              required
              minLength={6}
              value={form.password}
              onChange={set("password")}
              style={{ paddingRight: 58 }}
            />
            <button
              type="button"
              className="auth-field-toggle"
              aria-label={reveal ? "Hide password" : "Show password"}
              aria-pressed={reveal}
              onClick={() => setReveal((v) => !v)}
            >
              <EyeGlyph off={!reveal} />
            </button>
          </div>
        </div>

        {error && (
          <p id="register-error" className="auth-error" role="alert">
            {error}{error.includes("already has an account") && (
              <> <Link className="auth-link" href={routes.signIn}>Sign in</Link> · <Link className="auth-link" href={routes.forgotPassword}>Reset password</Link></>
            )}
          </p>
        )}

        <button className="auth-cta" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
