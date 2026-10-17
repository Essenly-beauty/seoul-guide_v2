/** Only allow navigation within this app after authentication. */
import { routes } from "@/lib/routes";

export function safeAuthNext(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f]/.test(raw)) {
    return null;
  }
  try {
    const origin = "https://myseouldrop.invalid";
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** New accounts finish the existing onboarding before returning to a deep link. */
export function registrationDestination(raw: unknown): string {
  const next = safeAuthNext(raw);
  if (!next) return routes.onboardingBasics;
  if (new URL(next, "https://myseouldrop.invalid").pathname === routes.onboardingBasics) return next;
  return `${routes.onboardingBasics}?${new URLSearchParams({ next })}`;
}

/** Signup screens may contain an onboarding wrapper; login skips that wrapper. */
export function registrationReturnPath(raw: unknown): string | null {
  const safe = safeAuthNext(raw);
  if (!safe) return null;
  const url = new URL(safe, "https://myseouldrop.invalid");
  return url.pathname === routes.onboardingBasics
    ? safeAuthNext(url.searchParams.get("next"))
    : safe;
}

export function authLinkWithNext(route: string, rawNext: unknown): string {
  const next = safeAuthNext(rawNext);
  return next ? `${route}?${new URLSearchParams({ next })}` : route;
}

export function signInFromRegistration(raw: unknown): string {
  return authLinkWithNext(routes.signIn, registrationReturnPath(raw));
}

export function oauthCallbackUrl(origin: string, rawNext: unknown): string {
  const next = safeAuthNext(rawNext) ?? routes.map;
  return `${origin}/auth/callback?${new URLSearchParams({ next })}`;
}

export function passwordResetDestination(rawNext: unknown): string {
  return authLinkWithNext(routes.resetPassword, rawNext);
}

/** A recovery token must land on the password form, never bypass it. */
export function recoveryCallbackTarget(rawNext: unknown): string {
  const safe = safeAuthNext(rawNext);
  return safe && new URL(safe, "https://myseouldrop.invalid").pathname === routes.resetPassword
    ? safe
    : routes.resetPassword;
}
