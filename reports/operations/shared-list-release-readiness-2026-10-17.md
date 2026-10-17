# Shared-list security release — 2026-10-17

This release moves shared-list reads behind an authenticated, exact-UUID server endpoint. Guests see a sign-in prompt; login, registration, Google OAuth, and password recovery preserve the original link. Owners can list and revoke their own shared links. Public link metadata does not expose the list title or saved places.

## Source and account verification

- Base: `main` at `f76792008778cd848953764627a1a7aab50ccca0`.
- Release branch: `release/shared-list-security-20261017`.
- Adapted the shared-list and auth-return changes from `release/member-guest-shared-main-integration-20260927`; retained current main's ratings, catalogue, and editorial changes.
- Initial release commit `979966f` was pushed as `mg1018-whatap`, with author `mg1018@Local <mg1018@whatap.io>`. That existing commit has not been rewritten.
- Future commits use `gksaudrhks12-sys <gksaudrhks12@gmail.com>`. Both the original checkout and this release copy select the account-specific SSH key locally; global Git identity is unchanged.
- The new key authenticates as `gksaudrhks12-sys` and can fetch the repository. However, `git push --dry-run origin HEAD:refs/heads/release/shared-list-security-20261017` was rejected with `Permission to Essenly-beauty/seoul-guide_v2.git denied to gksaudrhks12-sys`. Repository write access must be granted before any further push; do not fall back to another account.
- Git remote: `git@github.com:Essenly-beauty/seoul-guide_v2.git`.
- Local Vercel link identifies `seoul-guide-v2`, project `prj_5eidC5l66Xu01vsVyJhpmv5H3qXf`, team `team_F8hIyOkJ9p0Bdyn44Phngi1a`.
- Vercel CLI reports `loggedIn: false`. The current browser account `mg1018-6521` cannot open the historically recorded `admin-28156576s-projects/seoul-guide-v2` project (404). The intended project and current owner must be confirmed after authentication before production deployment.

## Verification

- `npm ci` completed using the existing lockfile.
- `npm test`: 112 files, 1,039 tests passed.
- `npm run typecheck` and `npm run lint` passed.
- `npm run build` passed and includes `/api/shared-lists/[id]`.
- `LC_ALL=ko_KR.UTF-8 LANG=ko_KR.UTF-8 npm run audit:data:check` passed. The existing audit output uses Korean collation; the default host locale reports it as stale without a data-content change.
- Local production HTTP checks: guest shared-list API `401`, `Cache-Control: private, no-store`; shared map and login documents `200`.
- The automated Chromium E2E could not launch: Chrome exited with `SIGABRT` before test actions. It is not recorded as a passing E2E.
- Connected Chrome rendered the guest sign-in banner and successfully opened the login form with the original shared UUID preserved in login, signup, and password-reset links.
- Authenticated recipient/owner runtime checks and production deployment verification remain pending.

## Database and rollout

- Migration-history entries `0009` and `0010` were repaired in the preceding database-maintenance step.
- `20260926072412_widen_place_ids_for_account_storage` was already applied to production; this branch records the exact migration in source control. It widens favorites/ratings IDs to 1,024 characters.
- `20260926083440_lock_down_shared_lists` is included but **has not been applied**. Current production still requires its public SELECT behavior.
- Deploy the app first to the confirmed existing Vercel project. Verify the server-only Supabase key with a signed-in recipient reading one exact shared link, plus owner creation/list/revocation.
- Only after those checks, apply the shared-list lockdown and verify that anon direct access is denied, authenticated direct access is owner-only, recipient API access still works, revoked links return 404, and existing link IDs remain intact.
- Do not run an unqualified database push before the app compatibility checks: it would apply the pending lockdown too early.

## Revalidation after account change

- Refreshed `origin/main` on 2026-10-17; it still points to `f767920`. The release code has no intervening upstream changes to integrate.
- Typecheck, lint, 112 test files / 1,039 tests, and the Korean-locale data audit passed again.
- A bare build in this isolated checkout initially failed because it has no `.env.local`. Loading only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the existing project configuration into the build process resolved it. The complete production build passed. No environment file or credential was copied into the release or committed.
- GitHub records a successful Vercel **Preview** deployment for `979966f`: https://seoul-guide-v2-faewqua9g-admin-28156576s-projects.vercel.app . Both unauthenticated map and API requests redirect to Vercel authentication. This is deployment success, not authenticated application verification; protection was not disabled.
- The latest **Production** entry in GitHub's deployment history is `f767920`, created 2026-10-15 17:26 KST. This does not prove that every deployment made outside the Git integration is represented in that history.
- Current production `https://seoul-guide-v2.vercel.app`: `/` and `/map` return 200; unauthenticated `/api/account/export` returns JSON 401 with `private, no-store`; the new shared-list API still returns HTML 404 and is not live there.
- Read-only live Supabase checks returned: profiles 5, favorites 10, ratings 3, shared_lists 1, feedback 0, published_reviews 0. Anonymous direct `shared_lists` access still returns 200 with count 1. No data or policies were changed during this revalidation.
- Vercel CLI still reports `loggedIn: false`; GitHub CLI credentials are unavailable/invalid in this execution environment. The browser session was `1018one`, and was not used to perform writes under the wrong account.
- Remaining gates: repository Write access for `gksaudrhks12-sys`; Vercel authentication and exact project/team confirmation; PR/CI review; signed-in owner/recipient preview checks; approved production rollout; then database lockdown and role-based verification.
