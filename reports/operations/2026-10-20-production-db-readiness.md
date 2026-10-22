# Production database readiness — 2026-10-20

## Applied to production — final status

All 11 explicitly allowlisted migrations were applied to production `njsocpyuesntblifpips` on **2026-10-20 at 02:01 UTC**. Each original version and SQL were committed in the same transaction. A fresh read-only preflight confirmed the expected old ledger, no conflicting booking schema, PostgreSQL 17.6, no pending public locks, and verified TLS before writes. The SQL cleanup in `20261019200212` removed only an extra EOF newline; its reviewed hash manifest was updated without changing SQL semantics.

Post-application checks confirmed 20 application tables with RLS, the private 5 MiB WebP-only `merchant-images` bucket, all 11 original ledger versions, and the continued absence of `20260926083440_lock_down_shared_lists`. PostgREST schema was reloaded. Production REST checks returned 200 for public catalog projection and booking catalog, and 401 for anonymous booking ledger, booking messages and booking-list RPC access. No production customer booking, payment or message was created.

Security advisors returned no ERROR findings. Eight INFO notices for tables with RLS and no policy are intentional deny-all direct-table access behind scoped RPCs ([linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)). Existing warnings remain for `public.touch_updated_at` mutable search path ([remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)) and disabled leaked-password checking ([Auth guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); these existing settings were not changed in this release.

The new Vercel production deployment `dpl_FwWGGZQrzYssTDEiiL9fGDy9BTbM` is READY and promoted. Merchant activation/membership/publication remains an explicit operational setup step: the production public merchant catalog is empty. Actual payment processing is not part of this implementation.

Applied-version evidence: `/private/tmp/myseouldrop-migrations-production.json`. API checks: `/private/tmp/myseouldrop-production-api-results.json`. Earlier read-only and pending-application statements below describe the state before this release.

Read-only deployment audit. No remote database write, migration push, project relink, environment change, or security-block workaround was performed.

## Latest verified state — 2026-10-20

This section supersedes the earlier connectivity and backup limitations below. Production data remains unchanged.

- The existing production project `njsocpyuesntblifpips` is ACTIVE_HEALTHY on PostgreSQL 17.6 (`170006`). Read-only remote ledger/schema checks confirmed all 11 allowlisted migrations missing, no `private` schema, no merchants/customer bookings tables, and no `merchant-images` bucket. The withheld shared-list migration remains absent.
- Existing favorites/profiles ownership RLS was checked, including UPDATE USING/WITH CHECK constraints. No waiting public table locks were observed during the audit.
- Direct PostgreSQL access now works with hostname validation and the official Supabase Root 2021 CA (`rejectUnauthorized: true`). Credentials were handled in memory without printing. CLI processes use a local DNS lookup helper without changing OS DNS or TLS checks.
- A private pg_dump archive of `public`, `review_internal`, `auth`, `storage`, and `supabase_migrations` was created and successfully restored into disposable local database `booking_release_rehearsal_1792460532653`, preserving owners and grants. It does not include actual Storage object files or every managed database schema.
- Verified archive: `/private/tmp/myseouldrop-production-backup-20261020/before-booking-migrations-complete.dump`, 462,491 bytes, SHA256 `95733d05aa33affad3ca78c63683469405fe654160fd1af1f62063900fffa68f`. The earlier archive lacking `review_internal` is not the verified restore source.
- Exactly the 11 allowlisted migrations passed on the restored database. All 20 affected application tables have RLS; `merchant-images` is private, limited to 5 MiB and `image/webp`. The withheld shared-list migration remained absent.
- Existing integration scripts passed on the restored DB: customer booking **56 checks**, partner operations **150 checks**. These verify tenant isolation, public/customer/partner contracts, availability, menu changes, immutable booking price snapshots, lifecycle changes, customer data, profile review, English staff fields, and media/storage RLS. Test fixtures were rolled back; the original local app database was not targeted.
- Production environment build passed. A staged Vercel deployment was created but blocked by Git author permissions (`TEAM_ACCESS_REQUIRED`). Production migrations are intentionally still pending until that deployment access issue is resolved.

The exact-file/hash manifest is `/private/tmp/myseouldrop-release-migrations.json`; the explicit-target migration runner is `/private/tmp/myseouldrop-apply-release-migrations.cjs`. The runner inserts each original version into migration history in the same transaction as its SQL, with 5-second lock and 60-second statement timeouts. Only `--rehearsal` has run. Reconfirm remote state before any `--production` execution.

## Earlier audit evidence

## Target and evidence limits

- Root `.vercel/project.json` identifies the existing `seoul-guide-v2` project, `prj_5eidC5l66Xu01vsVyJhpmv5H3qXf`, team `team_F8hIyOkJ9p0Bdyn44Phngi1a`.
- Root `supabase/.temp/project-ref` and both Supabase URL variables in the existing root environment agree on **`njsocpyuesntblifpips`**. The database URL points at `aws-0-us-east-1.pooler.supabase.com`. Environment values were read in memory; no credentials were printed or copied.
- Cached CLI metadata records PostgreSQL `17.6.1.155`, Auth `v2.195.0`, PostgREST `v14.15`, and Storage `v1.70.4`. These are cached values, not current remote measurements.
- The root deployment audit received DNS resolution failures for the Vercel API and deployment host. No repeated network attempts or alternate route around the browser security block were made. **Current remote migration history, schema, grants, storage configuration, active locks, and backup availability remain unverified.**

Historical production evidence: the [October 17 shared-list report](shared-list-release-readiness-2026-10-17.md) records `0009`, `0010`, and `20260926072412` as applied, and the [October 9 review-security report](review-security-release-2026-10-09.md) records `20261009052244` as applied. The October 17 report explicitly records `20260926083440_lock_down_shared_lists` as **withheld**. These reports do not substitute for reading today's migration ledger.

## Exact new prerequisite allowlist

The complete partner/booking implementation depends on these migrations, in order. They have local verification evidence; no report examined records their production application. Treat them as **candidate missing migrations** until the remote ledger and schema agree. Do not reapply a migration already present.

| Order | Version and name | Purpose |
| --- | --- | --- |
| 1 | `20261018080122_partner_configuration` | Merchant, membership, menu, calendar, audit tables and RLS |
| 2 | `20261018120627_partner_profile_platform_owned` | Removes direct partner writes to platform-owned merchant fields |
| 3 | `20261018121926_merchant_reservation_rules_and_overrides` | Reservation rules and dated schedule overrides |
| 4 | `20261018133400_partner_staff_storage` | Staff, menu assignments, staff calendars |
| 5 | `20261019140243_public_merchant_catalog` | Platform-owned place publication mapping and public catalog projection |
| 6 | `20261019191959_integrated_customer_bookings` | Customer booking ledger, availability, lifecycle, configuration locks and account-deletion cleanup |
| 7 | `20261019193411_authenticated_account_data_privileges` | Explicit ownership-policy-backed profile/favorites privileges |
| 8 | `20261019194943_partner_booking_operations` | Opaque merchant customer IDs, offline creation, reschedule, cancellation reasons |
| 9 | `20261019195512_partner_customer_notes_and_messages` | Customer notes, booking conversations, read receipts, export/deletion support |
| 10 | `20261019200212_partner_store_profile_and_staff_english` | Store instant fields/review requests, staff English fields, approved public profile |
| 11 | `20261019200901_merchant_media_storage` | Private image bucket, scoped object policies, attachment metadata and public approved images |

`20260926083440_lock_down_shared_lists` is **excluded** from this allowlist. Never run an unqualified `supabase db push` / `--include-all` against this checkout: it can apply the withheld migration along with these prerequisites.

## Existing local verification

The [partner operations report](2026-10-20-partner-operations.md) records 150 real PostgreSQL checks (rolled back); seven concurrent-connection scenarios with 28 assertions and seven observed advisory waits; 90 booking HTTP checks; 43 profile HTTP checks; 45 actual image upload/download/delete HTTP checks; and 128 targeted unit/API tests. The isolated Supabase database used port 54382, with Storage enabled only in its temporary local configuration. These checks did not use the production database.

The root agent's final application verification for this deployment attempt reports 174 test files / 2,241 tests passing, lint passing, and data audit passing. The production build remains blocked by `ENOTFOUND fonts.googleapis.com`, and live Vercel inspection by DNS/fetch failures. These results do not establish production runtime readiness.

## Compatibility checks before applying

- Several migration files use non-idempotent `CREATE TABLE`, `CREATE FUNCTION`, and `CREATE SCHEMA private`. Compare both migration history and schema objects. A missing ledger row with existing objects means possible manual application; stop and reconcile it, rather than blindly replaying SQL or marking it applied.
- The generated configuration migrations grant PostgreSQL 17 `MAINTAIN`. Cached PostgreSQL 17 is compatible; confirm the live server version before applying.
- The staff migration adds a unique constraint on `merchant_services(merchant_id,id)`. It takes a table lock. Read table size and active transactions before selecting a short lock timeout and rollout window.
- The partner operations migration adds columns/indexes and backfills opaque identities from `customer_bookings`. If an earlier booking schema is already running remotely, inspect row count, duplicate/constraint compatibility, and write load first.
- Booking migrations replace private lifecycle, quote and account-deletion helpers and install configuration-lock triggers. Preserve the existing customer Booking JSON/RPC contracts; new partner fields stay in separate operations endpoints. Verify the old customer endpoints after application.
- The account-privilege migration deliberately replaces grants on `favorites` and `profiles`; verify their existing ownership policies and account export/save behavior after application.
- Media requires working `storage.buckets` and `storage.objects`. `merchant-images` must be private, 5 MiB, WebP only. The migration rejects an existing bucket with a different configuration instead of changing it silently. Inspect existing bucket policies for unintended wider access.
- All new app APIs, including signed-in account export, require the new RPCs. Apply and verify actually-missing prerequisites before promoting the new application. An application rollback can retain the new schema; dropping booking/message tables after users write data is not a safe rollback.
- Schema migration does **not** provision a merchant membership, publish a merchant/place mapping, enable bookings, or assign a booking policy. These remain explicit platform operations. Payment mode remains `pay_at_venue`; there is no payment-provider integration or automatic refund.
- Store names/address/introduction and store photographs remain review-gated. The implementation persists requests/cancellation; it does not approve them automatically or provide an operator review console.

## Concrete execution plan once connectivity is available

1. Reconfirm the same Vercel and Supabase project IDs. Open a TLS-verified database connection using the existing credentials in memory, with connection/query timeouts. Do not put credentials in command arguments or logs.
2. Run `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`; read `supabase_migrations.schema_migrations`, `server_version_num`, relevant object definitions/RLS/grants, row counts, Storage bucket configuration, and active locks. End the read-only transaction. Resolve any unexpected remote migration or schema drift before writes.
3. Verify a recoverable backup and record affected schema/grants/row counts. Rehearse the exact missing allowlist on an isolated restore with Storage available. Local integration results are documented in [the backend report](2026-10-20-partner-operations.md); they are not a production-restore rehearsal.
4. Apply **only the verified missing versions in the table above**, in order, using a project-bound explicit allowlist. Each version and its migration-history insertion must be in the same transaction, with `lock_timeout` and `statement_timeout`; abort on mismatch or failure. Do not use `migration repair` as a substitute for executing missing SQL. Preserve the withheld shared-list version. Reload PostgREST schema after successful application.
5. Verify schema/privileges and authenticated tenant isolation, customer Booking compatibility, account export, and private/public image policy behavior. Run mutation checks only with explicit synthetic test identities/data and cleanup; never alter a real customer's reservation to prove deployment. Then promote the application to the existing Vercel project and verify actual runtime APIs and public pages. Keep previous Vercel deployment available for application rollback.
6. Treat shared-list lockdown as a separate subsequent change: first verify the deployed exact-link server endpoint with a signed-in recipient and owner create/list/revoke. Only then apply `20260926083440` and verify anonymous denial, owner-only direct reads, recipient server access and revoked-link 404. Preserve existing link IDs.

Current blockers are network/DNS access and the unverified live state/backup, not missing local migration files. No production deployment or database readiness pass is claimed by this audit.
