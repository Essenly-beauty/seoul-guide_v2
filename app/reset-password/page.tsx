"use client";

// Landing for the password-recovery email link (session already established
// by /auth/callback via verifyOtp type=recovery). Sets the new password.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [reveal, setReveal] = useState(false);
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (pw !== confirmPw) {
      setError("Passwords don't match — check both fields.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      setBusy(false);
      setError("This reset link has expired — request a new one from the sign-in screen.");
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) {
      setError(err.message.includes("different from the old")
        ? "New password must differ from your current one."
        : err.message);
      return;
    }
    router.push(routes.map);
    router.refresh();
  };

  return (
    <AuthShell
      title="New password"
      support="Choose a new password for your account."
      foot={<span className="caption dim">You&apos;ll stay signed in on this device.</span>}
    >
      <form onSubmit={submit} style={{ display: "contents" }}>
        <div className="auth-fields">
          <div className="auth-field-wrap">
            <input
              className="auth-field"
              type={reveal ? "text" : "password"}
              autoComplete="new-password"
              placeholder="New password"
              aria-label="New password"
              aria-invalid={!!error}
              aria-describedby={error ? "reset-error" : undefined}
              required
              minLength={6}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
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
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            aria-invalid={Boolean(error && error.includes("match"))}
            aria-describedby={error ? "reset-error" : undefined}
            required
            minLength={6}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
          />
        </div>
        {error && <p id="reset-error" className="auth-error" role="alert">{error}</p>}
        <button className="auth-cta" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
