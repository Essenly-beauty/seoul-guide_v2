# Review login gate design

## Decision and scope

Only a signed-in account may write or edit a review body. Anonymous visitors may still browse places, read public reviews, save places on their device, and leave a device-local star rating. A review body is neither drafted nor submitted while anonymous. This implements the owner's 2026-10-05 decision.

This is the first of two separate changes. It does not change the production database, the `public.public_reviews` view, or the author-name display. A follow-up database design will remove the view's `auth.users` dependency and avoid an automatic `Member`/first-name label. Do not deploy that database change without a recoverable backup and role-level tests.

## Existing behavior and alternatives

The current place detail and My review editor both render a body composer for visitors with a local star rating. `setReview` can persist anonymous body text to device storage, and the remote `main` merge path can later carry its `isPublic` flag to the account. The main workspace contains a concurrent, uncommitted attempt to keep guest notes private; this design must be implemented in an isolated branch without overwriting those edits.

Three approaches were considered:

1. **UI-only gate:** hide the composers for visitors. Smallest change, but stale pages or direct calls to `setReview` can still save anonymous body text.
2. **Store-only rejection:** reject anonymous calls in `setReview`. Correct persistence, but visitors still see a form that cannot work.
3. **Layered gate (chosen):** guard both UI entry points and `setReview`, while neutralizing legacy guest-public flags during account merge. It makes the rule visible and enforceable.

## User flow

### Place detail

Anonymous visitors can tap stars. Tapping **Write a review** or **Edit review** opens the existing sign-in sheet with copy that says signing in is required *before writing*. The textarea must not open. The sign-in and registration links return to the same place; after authentication, the visitor can enter the review composer with a fresh action. Dismissing the sheet leaves the star rating intact.

### My review editor

Direct navigation to `/mypage/reviews/[id]/edit` as an anonymous visitor shows a sign-in-required state, not the textarea or public-posting checkbox. While auth state is loading, show the existing loading state instead of briefly showing the composer or sign-in gate. Authentication returns to this editor URL, where an eligible account can write.

### Signed-in review

The existing signed-in save/edit/clear behavior remains. A new review's **Post publicly** checkbox starts unchecked; an already-public review preserves its checked state when edited. This ensures that public posting is an explicit action. Private review bodies remain account data, not public content.

## Data and safety behavior

`setReview` must refuse an anonymous body write and leave local review text unchanged. The caller gets a distinct auth-required result so it can show the sign-in prompt rather than a misleading success toast. Guest star ratings continue to use the existing device store.

Legacy anonymous review bodies created by older builds may still exist in device storage. On sign-in, their text may be imported as a **private** account note, but an old guest `isPublic` flag must never auto-publish it. The user must make a new public-posting choice after authentication. The already-uncommitted root-workspace fix is reference material, not a file to overwrite.

The server's existing ownership RLS remains a second boundary. This phase adds no migration, grants, new table, service-role call, or production write.

## Verification and release boundary

Automated checks cover both anonymous entry points, direct editor URL, `setReview` rejection without a user, legacy guest-flag private merge, authenticated review save, and default-unchecked public consent. Confirm guest stars and place discovery still work. Run unit tests, typecheck, lint, and focused browser E2E in the isolated branch.

The follow-up public-read-model/security-advisor work is a separate release. Until then, do not describe this login-gate change as resolving the `public.public_reviews` advisor findings or the dashboard's lack of an accessible backup.
