// Auth landing for OAuth and email links. Handles both flows:
//  - `code`        — PKCE exchange (OAuth, same-browser email links)
//  - `token_hash`  — verifyOtp (email links opened in ANY browser — set the
//                    Supabase email templates to token_hash links, docs/auth-setup.md)
// Errors forward to /login with a coarse reason the page can translate.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

/** Same-origin relative paths only — reject anything a browser could coerce
    into an absolute/protocol-relative hop (backslashes, //, control chars). */
function safeNext(raw: string | null, origin: string): string {
  const fallback = "/map";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) {
    return fallback;
  }
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"), url.origin);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  // On failure, keep the intended destination: the login page honors ?next=,
  // so the manual sign-in that follows still finishes the original journey
  // (mail-app confirmations otherwise skipped onboarding — found 2026-08-16).
  const errorSuffix = `&next=${encodeURIComponent(next)}`;

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error) {
      const target = otpType === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(new URL(target, url.origin));
    }
    const reason = error.code === "otp_expired" ? "expired" : "auth";
    return NextResponse.redirect(new URL(`/login?error=${reason}${errorSuffix}`, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    // PKCE exchange fails when the link is opened in a different browser than
    // the one that started the flow — surface that case distinctly.
    const reason = error.code === "validation_failed" ? "browser" : "auth";
    return NextResponse.redirect(new URL(`/login?error=${reason}${errorSuffix}`, url.origin));
  }

  // Supabase can also land here with error params and no code at all.
  const errCode = url.searchParams.get("error_code");
  const reason = errCode === "otp_expired" ? "expired" : "auth";
  return NextResponse.redirect(new URL(`/login?error=${reason}${errorSuffix}`, url.origin));
}
