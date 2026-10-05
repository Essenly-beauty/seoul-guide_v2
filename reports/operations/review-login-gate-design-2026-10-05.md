# Review login gate design

## Decision and scope

Only a signed-in account may submit or edit a place rating or review body. Anonymous visitors may still browse places, read public reviews, and save places on their device. Rating stars and review text belong to one account-only composition flow; neither is newly saved while anonymous. A signed-in person may save a rating without text, or add text to it. This incorporates the owner's 2026-10-05 clarification that stars and comments should be written together while exploration remains open to everyone.

This is the first of two separate changes. It does not change the production database, the `public.public_reviews` view, or the author-name display. A follow-up database design will remove the view's `auth.users` dependency and avoid an automatic `Member`/first-name label. Do not deploy that database change without a recoverable backup and role-level tests.

## Existing behavior and alternatives

The current place detail saves a star tap immediately, including for visitors. It then offers a separate body composer. `setReview` can persist anonymous body text to device storage, and the remote `main` merge path can later carry its `isPublic` flag to the account. The main workspace contains a concurrent, uncommitted attempt to keep guest notes private; this design must be implemented in an isolated branch without overwriting those edits.

Three approaches were considered:

1. **Keep instant star saves; gate only text:** minimal change, but stars and text remain separate and visitors can still rate.
2. **Gate the screens only:** visitors see a sign-in prompt, but direct calls to `setRating` or `setReview` can still save anonymous data.
3. **Unified composer and layered gate (chosen):** stars select a value in a shared rating/review composer; saving requires an account in both UI and store. Legacy guest-public flags are neutralized during account merge.

## User flow

### Place detail

An anonymous visitor who taps a rating star, **Write a review**, or **Edit review** gets a sign-in sheet explaining that an account is needed before rating or writing. No rating or body is saved and no textarea opens. Dismissing the sheet returns to the place without changing its information. The sign-in and registration links return to the same place; after authentication, the visitor can start a fresh rating/review action.

For a signed-in visitor, tapping a star opens the combined composer with that star selected. They may save a rating alone or add review text before saving. Editing an existing rating or review preloads its stars, text, and current public choice. The public-posting control is shown only when there is non-empty review text; rating-only rows are never public reviews.

### My review editor

Direct navigation to `/mypage/reviews/[id]/edit` as an anonymous visitor shows a sign-in-required state, not the textarea or public-posting checkbox. While auth state is loading, show the existing loading state instead of briefly showing the composer or sign-in gate. Authentication returns to this editor URL, where an eligible account can write.

The My reviews list and individual review page also show a sign-in-required state to visitors. The menu's My reviews count must not count legacy guest-local ratings. This is a presentation rule, not a deletion: old device records remain available for the one-time sign-in import.

### Signed-in review

The existing signed-in save/edit/clear behavior remains, apart from using one composer for stars and text. A new review's **Post publicly** checkbox starts unchecked; an already-public review preserves its checked state when edited. This ensures that public posting is an explicit action. Private review bodies and rating-only rows remain account data, not public content.

## Data and safety behavior

`setRating` and `setReview` must refuse anonymous writes and leave the local record unchanged. The caller gets a distinct auth-required result so it can show the sign-in prompt rather than a misleading success toast. The authorization check must happen before the optimistic local write. UI loading guards must prevent a briefly visible composer or sign-in prompt during auth-state resolution.

Legacy anonymous ratings and review bodies created by older builds may still exist in device storage. They are preserved but not presented as a new guest-authored rating; on sign-in they may be imported into the account, with any body forced **private**. An old guest `isPublic` flag must never auto-publish it. The user must make a new public-posting choice after authentication. The already-uncommitted root-workspace fix is reference material, not a file to overwrite.

The server's existing ownership RLS remains a second boundary. This phase adds no migration, grants, new table, service-role call, or production write.

## Verification and release boundary

Automated checks cover anonymous star and review entry points, direct editor URL, both store write rejections without a user, legacy guest-flag private merge, authenticated rating-only and rating-with-text saves, and default-unchecked public consent. Confirm place discovery and reading public reviews still work without login. Run unit tests, typecheck, lint, and focused browser E2E in the isolated branch.

The follow-up public-read-model/security-advisor work is a separate release. Until then, do not describe this login-gate change as resolving the `public.public_reviews` advisor findings or the dashboard's lack of an accessible backup.
