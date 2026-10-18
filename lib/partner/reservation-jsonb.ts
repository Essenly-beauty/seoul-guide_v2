import type { ReservationSchedule } from './reservation-calendar';

/**
 * PostgreSQL jsonb::text bytes for the validated schedule DTO shape. Its only
 * strings are fixed ASCII keys and ISO dates; PostgreSQL adds one space after
 * each structural comma/colon, regardless of object key order. Call after the
 * schedule validators, never on arbitrary JSON with different string values.
 */
export function reservationJsonbBytes(schedule: Pick<ReservationSchedule, 'hours' | 'breaks' | 'blocks' | 'overrides'>): number {
  const compact = JSON.stringify({ hours: schedule.hours, breaks: schedule.breaks, blocks: schedule.blocks, overrides: schedule.overrides });
  let quoted = false;
  let escaped = false;
  let separatorSpaces = 0;
  for (const character of compact) {
    if (escaped) { escaped = false; continue; }
    if (quoted && character === '\\') { escaped = true; continue; }
    if (character === '"') quoted = !quoted;
    else if (!quoted && (character === ':' || character === ',')) separatorSpaces += 1;
  }
  return new TextEncoder().encode(compact).byteLength + separatorSpaces;
}
