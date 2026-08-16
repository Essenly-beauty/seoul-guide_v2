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
