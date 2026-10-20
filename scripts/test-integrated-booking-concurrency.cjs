/* Multi-connection concurrency proof against an existing isolated local QA fixture.
 * Only generated request IDs and exact test transaction audit IDs are removed.
 * The temporary calendar block is restored with a compare-and-swap guard.
 * Usage: BOOKING_TEST_DB_PORT=54382 BOOKING_TEST_CUSTOMER_ID=<uuid> node scripts/test-integrated-booking-concurrency.cjs
 */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

const port = Number(process.env.BOOKING_TEST_DB_PORT);
const customer = process.env.BOOKING_TEST_CUSTOMER_ID;
const merchant = process.env.BOOKING_TEST_MERCHANT_ID || 'b1000000-0000-4000-8000-000000000001';
const service = process.env.BOOKING_TEST_SERVICE_ID || 'b1000000-0000-4000-8000-000000000003';
const staff = process.env.BOOKING_TEST_STAFF_ID || 'b1000000-0000-4000-8000-000000000005';
const place = process.env.BOOKING_TEST_PLACE_ID || 'myseouldrop-booking-studio';
if (!Number.isInteger(port) || port < 1024 || port > 65535 || [5432, 54322].includes(port)) throw Error('Use an isolated local QA database port');
if (!/^[0-9a-f-]{36}$/i.test(customer || '')) throw Error('BOOKING_TEST_CUSTOMER_ID is required');

const connections = [];
const requestIds = [];
const auditIds = [];
let originalBlocks;
let temporaryBlocks;
let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks += 1; };
async function connect(label, actor) {
  const client = new Client({ host: '127.0.0.1', port, user: 'postgres', password: process.env.BOOKING_TEST_DB_PASSWORD || 'postgres', database: 'postgres', application_name: `booking_concurrency_${label}` });
  await client.connect(); connections.push(client);
  await client.query("set statement_timeout='15s'");
  if (actor) {
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
    await client.query('set role authenticated');
  }
  return client;
}
const rows = async (client, query, args = []) => (await client.query(query, args)).rows;
async function rpc(client, name, args, values) { return (await rows(client, `select public.${name}(${args}) as data`, values))[0].data; }
async function callCreate(client, selection, requestId = randomUUID()) {
  if (!requestIds.includes(requestId)) requestIds.push(requestId);
  return rpc(client, 'booking_create', '$1,$2,$3,$4,$5,$6,$7,$8,$9', [place, service, staff, selection.slot.startAt, selection.quoteVersion, requestId, 'Concurrency test', '+82 10 9999 9999', 'Temporary isolated QA test']);
}
async function available(client, day) {
  const result = await rpc(client, 'booking_availability', '$1,$2,$3,$4', [place, service, staff, day]);
  assert.ok(result.slots.length > 0, `No fixture availability on ${day}`);
  return { slot: result.slots[0], quoteVersion: result.quoteVersion };
}
async function waitForAdvisory(client, waiter, blocker) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const activity = (await rows(client, 'select wait_event_type,wait_event,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1', [waiter.processID]))[0];
    if (activity?.wait_event_type === 'Lock' && activity.wait_event === 'advisory' && activity.blockers.includes(blocker.processID)) { checks += 1; return; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error('Concurrent request did not wait on the expected advisory lock');
}
function settle(promise) { return promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error })); }
async function cleanupBookings(admin) {
  await admin.query('begin');
  try {
    await admin.query('delete from public.customer_booking_events where booking_id in (select id from public.customer_bookings where merchant_id=$1 and customer_id=$2 and request_id=any($3::uuid[]))', [merchant, customer, requestIds]);
    await admin.query('delete from public.customer_bookings where merchant_id=$1 and customer_id=$2 and request_id=any($3::uuid[])', [merchant, customer, requestIds]);
    await admin.query('commit');
  } catch (error) { await admin.query('rollback'); throw error; }
}
async function collectAudits(client) {
  const data = await rows(client, 'select id from public.merchant_audit_events where merchant_id=$1 and xmin::text=txid_current()::text', [merchant]);
  auditIds.push(...data.map((row) => row.id));
}
function slotBlock(day, selection) {
  const localStart = new Date(Date.parse(selection.slot.startAt) + 9 * 60 * 60 * 1000);
  return { date: day, startMinute: localStart.getUTCHours() * 60 + localStart.getUTCMinutes(), endMinute: localStart.getUTCHours() * 60 + localStart.getUTCMinutes() + 1 };
}
async function restoreBlocks(admin) {
  if (!temporaryBlocks) return;
  await admin.query('begin');
  try {
    const restored = await admin.query('update public.merchant_schedules set blocks=$2::jsonb where merchant_id=$1 and blocks=$3::jsonb returning merchant_id', [merchant, JSON.stringify(originalBlocks), JSON.stringify(temporaryBlocks)]);
    assert.equal(restored.rowCount, 1, 'Calendar changed outside this test; refusing to overwrite it');
    await collectAudits(admin);
    await admin.query('commit'); temporaryBlocks = undefined;
  } catch (error) { await admin.query('rollback'); throw error; }
}

(async () => {
  const admin = await connect('observer');
  try {
    const owner = (await rows(admin, 'select user_id from public.merchant_memberships where merchant_id=$1 and revoked_at is null', [merchant]))[0]?.user_id;
    assert.ok(owner, 'Fixture requires an active merchant owner');
    assert.ok((await rows(admin, 'select id from auth.users where id=$1', [customer])).length, 'Fixture customer is missing');
    const first = await connect('first', customer);
    const second = await connect('second', customer);
    const partner = await connect('partner', owner);
    const dates = (await rows(admin, "select ((now() at time zone 'Asia/Seoul')::date+3)::text as first_day,((now() at time zone 'Asia/Seoul')::date+4)::text as config_day"))[0];
    originalBlocks = (await rows(admin, 'select blocks from public.merchant_schedules where merchant_id=$1', [merchant]))[0].blocks;

    // Different request IDs compete for exactly one staff slot. The loser waits
    // for the winner's transaction, then sees the committed occupancy.
    let selection = await available(admin, dates.first_day);
    await first.query('begin');
    const winner = await callCreate(first, selection);
    const competing = settle(callCreate(second, selection));
    await waitForAdvisory(admin, second, first);
    await first.query('commit');
    const loser = await competing;
    eq(loser.ok, false); eq(loser.error.message, 'SLOT_UNAVAILABLE');
    eq((await rows(admin, 'select count(*)::int as n from public.customer_bookings where merchant_id=$1 and staff_id=$2 and start_at=$3 and status in (\'requested\',\'confirmed\')', [merchant, staff, selection.slot.startAt]))[0].n, 1);
    assert.ok(winner.id); await cleanupBookings(admin);

    // A concurrent retry of one customer request returns the existing identity.
    selection = await available(admin, dates.first_day);
    const duplicateRequest = randomUUID();
    await first.query('begin');
    const original = await callCreate(first, selection, duplicateRequest);
    const duplicate = settle(callCreate(second, selection, duplicateRequest));
    await waitForAdvisory(admin, second, first);
    await first.query('commit');
    const retried = await duplicate;
    eq(retried.ok, true); eq(retried.value.id, original.id);
    eq((await rows(admin, 'select count(*)::int as n from public.customer_bookings where customer_id=$1 and request_id=$2', [customer, duplicateRequest]))[0].n, 1);
    await cleanupBookings(admin);

    // Configuration acquires the shared merchant lock first. Creation must
    // reread the calendar after it wakes up and reject the newly blocked slot.
    selection = await available(admin, dates.config_day);
    const blockedCalendar = [...originalBlocks, slotBlock(dates.config_day, selection)];
    await partner.query('begin');
    const configUpdate = await partner.query('update public.merchant_schedules set blocks=$2::jsonb where merchant_id=$1 and blocks=$3::jsonb', [merchant, JSON.stringify(blockedCalendar), JSON.stringify(originalBlocks)]);
    assert.equal(configUpdate.rowCount, 1, 'Calendar changed outside this test; refusing to overwrite it');
    await collectAudits(partner);
    const blockedCreation = settle(callCreate(second, selection));
    await waitForAdvisory(admin, second, partner);
    await partner.query('commit');
    temporaryBlocks = blockedCalendar;
    const blocked = await blockedCreation;
    eq(blocked.ok, false); eq(blocked.error.message, 'SLOT_UNAVAILABLE');
    await restoreBlocks(admin);

    // Creation acquires the lock first. A conflicting calendar edit must wait
    // and then reject, leaving the committed booking and original calendar intact.
    selection = await available(admin, dates.config_day);
    await first.query('begin');
    const preserved = await callCreate(first, selection);
    await partner.query('begin');
    const rejectedEdit = settle(partner.query('update public.merchant_schedules set blocks=$2::jsonb where merchant_id=$1', [merchant, JSON.stringify([...originalBlocks, slotBlock(dates.config_day, selection)])]));
    await waitForAdvisory(admin, partner, first);
    await first.query('commit');
    const rejected = await rejectedEdit;
    eq(rejected.ok, false); eq(rejected.error.code, '23514');
    await partner.query('rollback');
    eq((await rows(admin, 'select status from public.customer_bookings where id=$1', [preserved.id]))[0].status, preserved.status);
    eq((await rows(admin, 'select blocks from public.merchant_schedules where merchant_id=$1', [merchant]))[0].blocks, originalBlocks);
  } finally {
    // Release any transactions before cleanup, including failed test branches.
    await Promise.all(connections.map((client) => client.query('rollback').catch(() => {})));
    try {
      await cleanupBookings(admin);
      await restoreBlocks(admin);
      if (auditIds.length) await admin.query('delete from public.merchant_audit_events where merchant_id=$1 and id=any($2::uuid[])', [merchant, auditIds]);
    } finally { await Promise.all(connections.map((client) => client.end())); }
  }
  console.log(JSON.stringify({ status: 'passed', scenarios: 4, checks, advisoryWaits: 4, cleaned: true }));
})().catch((error) => { console.error({ code: error.code, message: error.message }); process.exitCode = 1; });
