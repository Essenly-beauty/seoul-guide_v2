# Shared-list security release — 2026-10-17

This release moves shared-list reads behind an authenticated, exact-UUID server endpoint. Guests see a sign-in prompt; login, registration, Google OAuth, and password recovery preserve the original link. Owners can list and revoke their own shared links. Public link metadata does not expose the list title or saved places.

## Source and account verification

- Base: `main` at `f76792008778cd848953764627a1a7aab50ccca0`.
- Release branch: `release/shared-list-security-20261017`.
- Adapted the shared-list and auth-return changes from `release/member-guest-shared-main-integration-20260927`; retained current main's ratings, catalogue, and editorial changes.
- `ssh -T git@github.com` authenticated as `mg1018-whatap`.
- Commit identity: `mg1018@Local <mg1018@whatap.io>`.
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
