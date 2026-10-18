import { expect, it } from 'vitest';
import { reservationJsonbBytes } from './reservation-jsonb';

it('measures the structural spaces in PostgreSQL jsonb text without counting punctuation inside strings', () => {
  const schedule = { hours: [], breaks: [], blocks: [], overrides: [{ date: '2026-11-05', hours: [{ startMinute: 0, endMinute: 1 }], breaks: [] }] };
  // Read-only local PostgreSQL jsonb_build_object(... )::text produced this
  // representation; JSONB may reorder keys, but reordering does not alter size.
  const postgres = '{"hours": [], "blocks": [], "breaks": [], "overrides": [{"date": "2026-11-05", "hours": [{"endMinute": 1, "startMinute": 0}], "breaks": []}]}';
  expect(new TextEncoder().encode(postgres).byteLength).toBe(141);
  expect(reservationJsonbBytes(schedule)).toBe(new TextEncoder().encode(postgres).byteLength);
});
