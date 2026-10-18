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

/** Ignore input-controlled array toJSON methods in the returned command and JSONB measurement. */
function calendarSnapshot(schedule: ReservationSchedule): StaffScheduleValues {
  const minute = ({ startMinute, endMinute }: { startMinute: number; endMinute: number }) => ({ startMinute, endMinute });
  return {
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
    const kind = input.kind;
    const mode = input.mode;
    if (kind === 'staffMenu') {
      if (!exactRecord(input, ['kind', 'mode', 'staffId', 'menuId']) ||
        (mode !== 'add' && mode !== 'remove')) return invalid;
      const staffId = input.staffId;
      const menuId = input.menuId;
      if (!canonicalUuid(staffId) || !canonicalUuid(menuId)) return invalid;
      return { ok: true, command: { kind, mode, staffId, menuId } };
    }
    if (kind !== 'staff' && kind !== 'staffSchedule') return invalid;
    if (mode !== 'create' && mode !== 'update') return invalid;
    const idKey = kind === 'staff' ? 'id' : 'staffId';
    if (!exactRecord(input, ['kind', 'mode', idKey, 'values', ...(mode === 'update' ? ['expectedUpdatedAt'] : [])])) return invalid;
    const id = input[idKey];
    const rawValues = input.values;
    const expectedUpdatedAt = mode === 'update' ? input.expectedUpdatedAt : undefined;
    if (!canonicalUuid(id) || (mode === 'update' && !timestamp(expectedUpdatedAt))) return invalid;
    if (kind === 'staff') {
      if (!exactRecord(rawValues, ['name', 'title', 'introduction', 'visibility', 'sortOrder'])) return invalid;
      const profile = {
        id: placeholder, merchantId: placeholder,
        name: rawValues.name, title: rawValues.title, introduction: rawValues.introduction,
        visibility: rawValues.visibility, sortOrder: rawValues.sortOrder, menuIds: [],
      };
      if (!reservationStaff(profile)) return invalid;
      const values: StaffProfileValues = {
        name: profile.name, title: profile.title, introduction: profile.introduction,
        visibility: profile.visibility, sortOrder: profile.sortOrder,
      };
      const command: StaffCommand = mode === 'create'
        ? { kind, mode, id, values }
        : { kind, mode, id, expectedUpdatedAt: expectedUpdatedAt as string, values };
      return { ok: true, command };
    } else {
      if (!exactRecord(rawValues, ['hours', 'breaks', 'blocks', 'overrides'])) return invalid;
      const schedule: unknown = {
        merchantId: placeholder, hours: rawValues.hours, breaks: rawValues.breaks,
        blocks: rawValues.blocks, overrides: rawValues.overrides,
      };
      if (!reservationSchedule(schedule)) return invalid;
      const values = calendarSnapshot(schedule);
      if (!reservationSchedule({ merchantId: placeholder, ...values }) || reservationJsonbBytes(values) > 256 * 1024) return invalid;
      const command: StaffCommand = mode === 'create'
        ? { kind, mode, staffId: id, values }
        : { kind, mode, staffId: id, expectedUpdatedAt: expectedUpdatedAt as string, values };
      return { ok: true, command };
    }
  } catch { return invalid; }
}
