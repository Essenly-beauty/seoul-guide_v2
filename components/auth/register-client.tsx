"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/profile";
import { routes } from "@/lib/routes";

// Mirrors the onboarding question so the answer pre-fills the profile.
const COUNTRIES = [
  ["US", "United States"], ["JP", "Japan"], ["CN", "China"], ["TW", "Taiwan"],
  ["TH", "Thailand"], ["KR", "South Korea"], ["OTHER", "Other"],
] as const;

const RESEND_COOLDOWN_S = 60;

function safeNext(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

export function RegisterClient({ next }: { next?: string }) {
  const router = useRouter();
  const onboardingTarget = safeNext(next) ?? routes.onboardingBasics;
  const [reveal, setReveal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", country: "" });
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
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
    if (form.password !== form.confirm) {
      setError("Passwords don't match — check both fields.");
      return;
    }
    setBusy(true);
    setError(null);
    // country pre-fills the beauty profile (guest-local now, merged into the
    // account after confirmation by the profile store)
    if (form.country) updateProfile({ countryCode: form.country });
    const supabase = supabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.name.trim(),
          marketing_opt_in: marketing,
          consented_at: new Date().toISOString(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(onboardingTarget)}`,
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
      router.push(onboardingTarget);
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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(onboardingTarget)}`,
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
        <p className="auth-support" style={{ marginTop: 18 }}>
          Confirmed it already (maybe on another device)?{" "}
          <Link className="auth-link" href={routes.signIn}>Sign in</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Register"
      support={<>Create your free account and start saving places right away. Need help? <Link className="auth-link" href={routes.support}>Contact us</Link></>}
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
          <input
            className="auth-field"
            type={reveal ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm password"
            aria-label="Confirm password"
            aria-invalid={!!error && error.includes("match")}
            required
            minLength={6}
            value={form.confirm}
            onChange={set("confirm")}
          />
          <select
            className="auth-field"
            aria-label="Country (optional)"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            style={{ color: form.country ? undefined : "var(--dim)" }}
          >
            <option value="">Where are you visiting from? (optional)</option>
            {COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        <div className="stack" style={{ gap: 10, marginTop: 16 }}>
          <label className="row caption" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-label="Agree to the Terms and Privacy Policy"
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--accent)" }}
            />
            <span style={{ flex: 1 }}>
              I agree to the <Link className="auth-link" href={routes.legalTerms}>Terms of Service</Link> and{" "}
              <Link className="auth-link" href={routes.legalPrivacy}>Privacy Policy</Link>. (required)
            </span>
          </label>
          <label className="row caption muted" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              aria-label="Receive tips and updates by email"
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--accent)" }}
            />
            <span style={{ flex: 1 }}>Send me Seoul beauty tips and app updates. (optional)</span>
          </label>
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
