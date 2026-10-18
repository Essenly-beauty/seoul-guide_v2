import { exactKeys, record, timestamp } from './contracts';
import { reservationRules, type ReservationRules } from './reservation-config';
import { reservationSchedule, type DateOverride } from './reservation-calendar';

type Version = { mode: 'create'; expectedUpdatedAt?: never } | { mode: 'update'; expectedUpdatedAt: string };
export type ReservationCommand =
  | ({ kind: 'reservationRules'; values: Omit<ReservationRules, 'merchantId'> } & Version)
  | ({ kind: 'dateOverrides'; values: { overrides: DateOverride[] } } & Version);

const placeholder = '00000000-0000-0000-0000-000000000000';
function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && exactKeys(value, keys) && Reflect.ownKeys(value).length === keys.length;
}

export function parseReservationCommand(input: unknown): { ok: true; command: ReservationCommand } | { ok: false; errors: string[] } {
  const invalid = { ok: false as const, errors: ['command.invalid'] };
  try {
    if (!exactRecord(input, ['kind', 'mode', 'values', ...(record(input) && input.mode === 'update' ? ['expectedUpdatedAt'] : [])]) ||
      (input.kind !== 'reservationRules' && input.kind !== 'dateOverrides') ||
      (input.mode !== 'create' && input.mode !== 'update') ||
      (input.mode === 'update' && !timestamp(input.expectedUpdatedAt))) return invalid;
    if (input.kind === 'reservationRules') {
      if (!exactRecord(input.values, ['mode', 'capacity', 'startDate', 'endDate', 'minimumLeadMinutes', 'slotIntervalMinutes']) ||
        !reservationRules({ ...input.values, merchantId: placeholder })) return invalid;
    } else if (!exactRecord(input.values, ['overrides']) || !reservationSchedule({
      merchantId: placeholder, hours: [], breaks: [], blocks: [], overrides: input.values.overrides,
    })) return invalid;
    return { ok: true, command: input as ReservationCommand };
  } catch { return invalid; }
}
