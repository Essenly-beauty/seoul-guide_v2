#!/bin/zsh
# Exercise the revised apply / rollback runners against a disposable local stack (port 54522, restored rehearsal DB).
# Each case prints PASS/FAIL. Nothing here touches production or the shared QA stacks.
set -u
T=/private/tmp/claude-501/-Users-hanmyeong-gwan-mobile-design/c0d42143-4b4a-430f-8cde-e410efaabd0e/scratchpad/runner-test
RUN=$T/ops/run; N=$(cat $T/ops/rehearsal-db-name); C2=supabase_db_runner-check-20261022
q() { docker exec -i -e PGPASSWORD=postgres $C2 psql -h 127.0.0.1 -U postgres -d "$N" -v ON_ERROR_STOP=1 -At "$@"; }
pass=0; fail=0
check() { if eval "$2"; then print -r -- "PASS $1"; pass=$((pass+1)); else print -r -- "FAIL $1"; fail=$((fail+1)); fi; }
apply() { node $RUN/apply-show-photos.cjs --rehearsal > $T/out.txt 2> $T/err.txt; print $? > $T/code.txt; }
rollback() { node $RUN/rollback-show-photos.cjs --rehearsal > $T/out.txt 2> $T/err.txt; print $? > $T/code.txt; }
code() { cat $T/code.txt; }
ledger() { q -c "select count(*)||'/'||max(version) from supabase_migrations.schema_migrations"; }

print "== start: ledger $(ledger)"

# T7 freeze: a store row must stop PRE_GUARD with the counts, and nothing must change
q -c "insert into public.merchants default values" >/dev/null
apply
check "T7 freeze violation stops PRE_GUARD (exit 1)" '[[ $(code) == 1 ]] && grep -q "onboarding freeze was broken" $T/err.txt && grep -q "{1,0,0,0,0}" $T/err.txt'
check "T7 ledger unchanged" '[[ $(ledger) == 23/20261019200901 ]]'
q -c "begin; alter table public.merchants disable trigger partner_audit; delete from public.merchant_audit_events; delete from public.merchants; alter table public.merchants enable trigger partner_audit; commit;" >/dev/null
check "T7 cleanup left no store rows" '[[ $(q -c "select count(*) from public.merchants") == 0 ]]'

# T8 ledger lock: another session holding ROW EXCLUSIVE on the ledger (what an INSERT takes) blocks PRE_GUARD's lock
( q -c "begin; lock table supabase_migrations.schema_migrations in row exclusive mode; select pg_sleep(7); rollback;" >/dev/null 2>&1 ) &
sleep 1.5; apply; wait
check "T8 ledger writer blocks the runner (55P03 lock_timeout)" '[[ $(code) == 1 ]] && grep -q "\"error\":\"55P03\"" $T/err.txt'
check "T8 ledger unchanged" '[[ $(ledger) == 23/20261019200901 ]]'

# T9 freeze-table lock: a writer on customer_bookings blocks the runner the same way
( q -c "begin; lock table public.customer_bookings in row exclusive mode; select pg_sleep(7); rollback;" >/dev/null 2>&1 ) &
sleep 1.5; apply; wait
check "T9 freeze-table writer blocks the runner (55P03)" '[[ $(code) == 1 ]] && grep -q "\"error\":\"55P03\"" $T/err.txt'

# T1 apply
apply; cp $T/out.txt $T/t1-out.txt
check "T1 apply commits (exit 0, applied, postCommitOk)" '[[ $(code) == 0 ]] && grep -q "\"applied\":\"20261020123000_store_profile_show_photos.sql\"" $T/out.txt && grep -q "\"postCommitOk\":true" $T/out.txt'
check "T1 ledger 24 / head target" '[[ $(ledger) == 24/20261020123000 ]]'

# T2 rerun = verified skip
apply
check "T2 rerun is a verified skip" '[[ $(code) == 0 ]] && grep -q "\"skip\":\"20261020123000_store_profile_show_photos.sql\",\"verified\":\[\"LEDGER_GUARD\",\"POST_GUARD\"\]" $T/out.txt'

# T3 tampered ledger row: skip verification must fail on LEDGER_GUARD
q -c "update supabase_migrations.schema_migrations set statements[1] = statements[1] || ' ' where version = '20261020123000'" >/dev/null
apply
check "T3 tampered ledger row fails skip-verify" '[[ $(code) == 1 ]] && grep -q "\"phase\":\"skip-verify\"" $T/err.txt && grep -q "LEDGER_GUARD: the 20261020123000 ledger row" $T/err.txt'
q -c "update supabase_migrations.schema_migrations set statements[1] = left(statements[1], -1) where version = '20261020123000'" >/dev/null

# T4 changed column default: skip verification must fail on POST_GUARD
q -c "alter table public.merchant_store_profiles alter column show_photos drop default" >/dev/null
apply
check "T4 changed column fails skip-verify on POST_GUARD" '[[ $(code) == 1 ]] && grep -q "\"phase\":\"skip-verify\"" $T/err.txt && grep -q "POST_GUARD: show_photos definition mismatch" $T/err.txt'
q -c "alter table public.merchant_store_profiles alter column show_photos set default true" >/dev/null
apply
check "T4b restored state skips again" '[[ $(code) == 0 ]] && grep -q "\"verified\"" $T/out.txt'

# T5 rollback negative: target is not the ledger head
q -c "insert into supabase_migrations.schema_migrations(version, name, statements) values ('20261021999999', 'c4_negative_probe', array['-- c4 negative probe'])" >/dev/null
rollback
check "T5 rollback refuses when target is not the head" '[[ $(code) == 1 ]] && grep -q "is not the ledger head" $T/err.txt'
q -c "delete from supabase_migrations.schema_migrations where version = '20261021999999'" >/dev/null

# T5b rollback ledger lock: a ledger writer blocks the rollback
( q -c "begin; lock table supabase_migrations.schema_migrations in row exclusive mode; select pg_sleep(7); rollback;" >/dev/null 2>&1 ) &
sleep 1.5; rollback; wait
check "T5b ledger writer blocks the rollback (55P03)" '[[ $(code) == 1 ]] && grep -q "\"error\":\"55P03\"" $T/err.txt'
check "T5b ledger still 24" '[[ $(ledger) == 24/20261020123000 ]]'

# T6 rollback
rollback
check "T6 rollback commits (23 rows, head 20261019200901)" '[[ $(code) == 0 ]] && grep -q "\"rolledBack\"" $T/out.txt && [[ $(ledger) == 23/20261019200901 ]]'
check "T6 column gone" '[[ $(q -c "select count(*) from pg_attribute where attrelid = '\''public.merchant_store_profiles'\''::regclass and attname = '\''show_photos'\'' and not attisdropped") == 0 ]]'

# T10 reapply and skip
apply
check "T10 reapply commits" '[[ $(code) == 0 ]] && grep -q "\"applied\"" $T/out.txt && grep -q "\"postCommitOk\":true" $T/out.txt'
apply
check "T10 rerun skips (verified)" '[[ $(code) == 0 ]] && grep -q "\"verified\"" $T/out.txt'

print "== end: ledger $(ledger); $pass passed, $fail failed"
