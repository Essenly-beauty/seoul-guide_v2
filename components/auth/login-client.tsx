"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { EyeGlyph } from "@/components/brand/auth-glyphs";
import { supabaseBrowser } from "@/lib/supabase/client";
import { routes } from "@/lib/routes";

/** Reasons /auth/callback can forward here with (review: one generic message
    hid expired links and cross-browser PKCE failures behind the same copy). */
const CALLBACK_ERRORS: Record<string, string> = {
  auth: "That sign-in link didn't work — sign in with your password instead.",
  expired: "That link has expired — sign in, or request a fresh one.",
  browser: "That link was opened in a different browser, so it couldn't finish — your email may already be confirmed. Try signing in with your password.",
};

/** Same-origin relative paths only (mirrors the server-side guard). */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = safeNext(searchParams.get("next")) ?? routes.map;
  const [reveal, setReveal] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    return code ? CALLBACK_ERRORS[code] ?? CALLBACK_ERRORS.auth : null;
  });

  // The callback-error banner should show once, not resurrect on reload/back.
  useEffect(() => {
    if (searchParams.get("error")) router.replace(routes.signIn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: id.trim(),
      password: pw,
    });
    if (err) {
      setBusy(false);
      setError(
        err.message === "Invalid login credentials"
          ? "Email or password doesn't match — please try again."
          : err.message === "Email not confirmed"
            ? "Please confirm your email first — check your inbox for our link."
            : err.message,
      );
      return;
    }
    router.push(nextTarget);
    router.refresh();
  };

  return (
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
          aria-describedby={error ? "signin-error" : undefined}
          required
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <div className="auth-field-wrap">
          <input
            className="auth-field"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            aria-invalid={!!error}
            aria-describedby={error ? "signin-error" : undefined}
            required
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
      </div>

      {error && <p id="signin-error" className="auth-error" role="alert">{error}</p>}

      <Link className="auth-aside" href={routes.forgotPassword}>Forgot password?</Link>
      <button className="auth-cta" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

export function LoginClient() {
  return (
    <AuthShell
      title="Sign in"
      support={<>If you need any support <Link className="auth-link" href={routes.support}>click here</Link></>}
      foot={<>Not a member? <Link className="auth-link" href={routes.register}>Register now</Link></>}
    >
      {/* useSearchParams needs a Suspense boundary in app router pages */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
