/** Whether a "no user" answer from `auth.getUser()` is a definite sign-out —
    no stored session (AuthSessionMissingError), or the server rejected the
    session (401/403) — rather than the device being offline or the auth server
    hiccupping. Only a definite answer may sign the UI out or wipe a signed-in
    account's device copy; anything else waits for the next auth event
    (review 2026-10-21). Same rule as `lib/booking/server.ts` uses for API auth. */
export function isDefiniteSignOut(error: unknown): boolean {
  if (!error) return true;
  const e = error as { name?: string; status?: number };
  return e.name === "AuthSessionMissingError" || e.status === 401 || e.status === 403;
}
