"use client";

// Real password recovery (review finding: the old "Recovery password" link
// dead-ended at the FAQ). Sends a reset email; the link lands on
// /auth/callback (recovery type) which forwards to /reset-password.

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

export default function ForgotPasswordPage() {
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
      redirectTo: `${window.location.origin}/auth/callback`,
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
      support={sent
        ? <>If an account exists for <b style={{ color: "var(--text)" }}>{email.trim()}</b>, a reset link is on its way.</>
        : <>Enter your account email and we&apos;ll send a reset link.</>}
      foot={<>Remembered it? <Link className="auth-link" href={routes.signIn}>Sign in</Link></>}
    >
      {sent ? (
        <p className="auth-support" style={{ marginTop: 28, lineHeight: 1.6 }}>
          Open the link on this device to choose a new password.
          Didn&apos;t get it? Check spam, or try again in a minute.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: "contents" }}>
          <div className="auth-fields">
            <input
              className="auth-field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Enter email"
              aria-label="Email"
              aria-invalid={!!error}
              aria-describedby={error ? "forgot-error" : undefined}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p id="forgot-error" className="auth-error" role="alert">{error}</p>}
          <button className="auth-cta" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
