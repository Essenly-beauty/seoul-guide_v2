// Password policy shared by sign-up and reset (NIST SP 800-63B-4 §3.1.1:
// length over composition rules; Supabase Auth hashes with bcrypt, which
// ignores bytes past 72, so anything longer must be refused, not truncated).
// Keep the Supabase dashboard minimum (Auth → Password) at the same value.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Human-readable reason a password is unacceptable, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password needs at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Password is too long — keep it under ${PASSWORD_MAX_BYTES} bytes (about ${Math.floor(PASSWORD_MAX_BYTES / 3)} Korean or ${PASSWORD_MAX_BYTES} Latin characters).`;
  }
  return null;
}
