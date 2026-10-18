import { exactKeys, record, timestamp, uuid } from './contracts';
import { reservationStaff, type ReservationStaff } from './reservation-config';
import { reservationSchedule, type ReservationSchedule } from './reservation-calendar';
import { reservationJsonbBytes } from './reservation-jsonb';

export type StaffProfileValues = Pick<ReservationStaff, 'name' | 'title' | 'introduction' | 'visibility' | 'sortOrder'>;
export type StaffScheduleValues = Omit<ReservationSchedule, 'merchantId'>;

type Version = { mode: 'create'; expectedUpdatedAt?: never } | { mode: 'update'; expectedUpdatedAt: string };
export type StaffCommand =
  | ({ kind: 'staff'; id: string; values: StaffProfileValues } & Version)
  | { kind: 'staffMenu'; mode: 'add' | 'remove'; staffId: string; menuId: string }
  | ({ kind: 'staffSchedule'; staffId: string; values: StaffScheduleValues } & Version);

const placeholder = '00000000-0000-0000-0000-000000000000';

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && exactKeys(value, keys) && Reflect.ownKeys(value).length === keys.length;
}

function canonicalUuid(value: unknown): value is string {
  return uuid(value) && value.length === 36 && value === value.toLowerCase();
}

function copyList<T, U>(items: T[], maximum: number, copy: (item: T) => U): U[] {
  const length = items.length;
  if (!Number.isSafeInteger(length) || length > maximum) throw new Error('schedule.invalid');
  const result: U[] = [];
  for (let index = 0; index < length; index++) result.push(copy(items[index]));
  return result;
}

/** Ignore input-controlled array toJSON methods when measuring PostgreSQL's jsonb size. */
function calendarSnapshot(schedule: ReservationSchedule): ReservationSchedule {
  const minute = ({ startMinute, endMinute }: { startMinute: number; endMinute: number }) => ({ startMinute, endMinute });
  return {
    merchantId: placeholder,
    hours: copyList(schedule.hours, 128, (period) => ({ weekday: period.weekday, ...minute(period) })),
    breaks: copyList(schedule.breaks, 128, (period) => ({ weekday: period.weekday, ...minute(period) })),
    blocks: copyList(schedule.blocks, 512, (block) => ({ date: block.date, ...minute(block) })),
    overrides: copyList(schedule.overrides, 366, (override) => ({
      date: override.date,
      hours: copyList(override.hours, 128, minute),
      breaks: copyList(override.breaks, 128, minute),
    })),
  };
}

export function parseStaffCommand(input: unknown): { ok: true; command: StaffCommand } | { ok: false; errors: string[] } {
  const invalid = { ok: false as const, errors: ['command.invalid'] };
  try {
    if (!record(input)) return invalid;
    if (input.kind === 'staffMenu') {
      if (!exactRecord(input, ['kind', 'mode', 'staffId', 'menuId']) ||
        (input.mode !== 'add' && input.mode !== 'remove') ||
        !canonicalUuid(input.staffId) || !canonicalUuid(input.menuId)) return invalid;
      return { ok: true, command: input as StaffCommand };
    }
    if (input.kind !== 'staff' && input.kind !== 'staffSchedule') return invalid;
    if (input.mode !== 'create' && input.mode !== 'update') return invalid;
    const idKey = input.kind === 'staff' ? 'id' : 'staffId';
    if (!exactRecord(input, ['kind', 'mode', idKey, 'values', ...(input.mode === 'update' ? ['expectedUpdatedAt'] : [])]) ||
      !canonicalUuid(input[idKey]) || (input.mode === 'update' && !timestamp(input.expectedUpdatedAt))) return invalid;
    if (input.kind === 'staff') {
      if (!exactRecord(input.values, ['name', 'title', 'introduction', 'visibility', 'sortOrder']) ||
        !reservationStaff({ ...input.values, id: placeholder, merchantId: placeholder, menuIds: [] })) return invalid;
    } else {
      if (!exactRecord(input.values, ['hours', 'breaks', 'blocks', 'overrides'])) return invalid;
      const schedule: unknown = { ...input.values, merchantId: placeholder };
      if (!reservationSchedule(schedule)) return invalid;
      const snapshot = calendarSnapshot(schedule);
      if (!reservationSchedule(snapshot) || reservationJsonbBytes(snapshot) > 256 * 1024) return invalid;
    }
    return { ok: true, command: input as StaffCommand };
  } catch { return invalid; }
}
