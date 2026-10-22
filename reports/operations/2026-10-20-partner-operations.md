# Partner operations backend verification

The partner dashboard uses the same persistent booking ledger as MYSEOULDROP. Customer booking DTOs and legacy partner booking/staff endpoints retain their existing shapes.

## Supported operations

| Endpoint | Behavior |
| --- | --- |
| `GET /api/partner/operations/bookings` | Merchant-scoped enriched bookings and published `placeId` |
| `POST /api/partner/operations/bookings` | Idempotent phone/walk-in creation, confirmed, pay at venue |
| `GET/PATCH /api/partner/operations/bookings/:id` | Detail, confirm, cancel with reason, complete, no-show, reschedule |
| `GET /api/partner/operations/bookings/:id/availability` | Snapshot-duration availability excluding the selected booking |
| `GET/PATCH /api/partner/operations/customers/:id` | Versioned customer memo using an opaque merchant customer ID |
| `GET/POST/PATCH /api/bookings/:id/messages` | Customer conversation, idempotent message, own read receipt |
| `GET/POST/PATCH /api/partner/operations/bookings/:id/messages` | Merchant side of the same conversation |
| `GET /api/partner/operations/messages` | Latest messages and merchant unread counts |
| `GET/PATCH /api/partner/operations/profile` | Immediate contact/English-support/notice changes; reviewed-copy requests and cancellation |
| `GET /api/places/:id/profile` | Published approved store copy plus immediate fields |
| `GET/POST/PATCH /api/partner/operations/staff/:id/profile` | Atomic base and English staff profile creation/editing |
| `GET/POST /api/partner/operations/media` | Merchant attachments and actual multipart image uploads |
| `DELETE /api/partner/operations/media/:id` | Versioned attachment deletion and Storage object removal |
| `GET /api/places/:id/media` | Published active store/menu/staff attachments |

Image content routes are returned in each media DTO. Store photographs remain pending for actual operator review. Menu and staff images become active immediately and are public only while their merchant/publication/target is visible. The private `merchant-images` bucket uses authenticated ownership policies; immutable object keys prevent overwrites. JPEG, PNG, and WebP inputs are limited to 5 MiB and 40 million pixels, stripped of metadata, and encoded as WebP within 2048 × 2048.

Rescheduling preserves the original price, service duration, and cleanup duration, rechecks current menu/staff eligibility and shop/staff calendars, excludes only that booking from occupancy, and serializes with customer creation and configuration edits through advisory lock namespace `702020`. Version conflicts return HTTP 409. New bookings and reschedules use the current approved English store/staff name when present; historical booking snapshots remain recorded values.

App customer IDs returned to merchants are random merchant-scoped identities. Offline identities group by normalized phone within a merchant and never claim an app account. Offline bookings have no authenticated customer and cannot receive app messages. Account export includes the account's conversations and customer notes; account deletion removes associated conversations/notes/opaque identity and erases booking contact information and cancellation reason.

## Verification completed locally

- `scripts/test-partner-operations-db.cjs`: 150 checks against real PostgreSQL, rolled back.
- `scripts/test-partner-operations-concurrency.cjs`: seven multi-connection scenarios, 28 assertions, seven observed advisory waits; generated reservations and temporary configuration removed/restored.
- `scripts/test-partner-operations-http.cjs`: 90 HTTP checks through Next.js and Supabase; generated bookings cancelled, original memo restored.
- `scripts/test-partner-profile-http.cjs`: 43 HTTP checks; original profile and English staff values restored.
- `scripts/test-partner-media-http.cjs`: 45 HTTP checks with a real synthetic PNG; objects deleted and synthetic staff archived.
- Seven targeted Vitest suites: 128 passing tests, including legacy customer booking and account export regressions.
- TypeScript, scoped ESLint, and `git diff --check` passed.
- Supabase security advisors: no errors or new warnings. Existing warnings concern `public.touch_updated_at` search path and the pre-existing `web_vitals_insert_any` telemetry policy.

All four new migrations were applied to the isolated local database on port 54382. Storage was enabled in its temporary Supabase configuration and the local stack restarted with database volumes preserved. No remote migrations, commit, push, external messages, payment collection, or simulated review approval were performed.

Migration files:

- `20261019194943_partner_booking_operations.sql`
- `20261019195512_partner_customer_notes_and_messages.sql`
- `20261019200212_partner_store_profile_and_staff_english.sql`
- `20261019200901_merchant_media_storage.sql`
