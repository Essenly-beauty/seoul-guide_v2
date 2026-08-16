// Phone helpers for SMS verification (E.164 composition + light validation).
// Dial codes mirror the signup country list, travelers-first.

export const DIAL_CODES = [
  { code: "+82", label: "South Korea (+82)" },
  { code: "+1", label: "US / Canada (+1)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+86", label: "China (+86)" },
  { code: "+886", label: "Taiwan (+886)" },
  { code: "+66", label: "Thailand (+66)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+61", label: "Australia (+61)" },
] as const;

/** Digits only, drops one leading 0 (E.164 style: 010-1234-5678 → +821012345678). */
export function toE164(dial: string, local: string): string | null {
  const digits = local.replace(/[^\d]/g, "").replace(/^0/, "");
  if (digits.length < 7 || digits.length > 12) return null;
  return `${dial}${digits}`;
}

/** Loose display grouping for the confirmation copy — splits the dial code
    against the known list (a bare regex backtracks into the wrong split). */
export function formatPhone(e164: string): string {
  const dial = DIAL_CODES.map((d) => d.code)
    .sort((a, b) => b.length - a.length)
    .find((c) => e164.startsWith(c));
  if (!dial) return e164;
  const rest = e164.slice(dial.length);
  const groups =
    rest.length > 8
      ? [rest.slice(0, rest.length - 8), rest.slice(-8, -4), rest.slice(-4)]
      : rest.length > 4
        ? [rest.slice(0, -4), rest.slice(-4)]
        : [rest];
  return `${dial} ${groups.join("-")}`;
}

/** True only for genuine "the owner hasn't connected an SMS provider yet"
    errors. A runtime send failure (bad number, carrier, rate limit) must
    NOT match — telling those users the feature doesn't exist is a silent
    churn path (auth doc issue #2, 2026-08-16). */
export function smsProviderNotReady(msg: string): boolean {
  return /(phone|sms)[^.]*(disabled|not enabled)|(disabled|not enabled)[^.]*(phone|sms)|sms provider[^.]*(missing|not|could not be found)|no sms provider|error finding sms provider/i.test(msg);
}

/** Actionable copy for SMS send failures, by failure class. */
export function smsSendErrorCopy(msg: string): string {
  if (/invalid|unsupported|not a valid|format/i.test(msg)) {
    return "That number doesn't look right — double-check the country code and digits.";
  }
  if (/rate|too many|frequency|security purposes|seconds/i.test(msg)) {
    return "Too many attempts — wait a minute and try again.";
  }
  return "Couldn't send the code right now — try again in a moment.";
}
