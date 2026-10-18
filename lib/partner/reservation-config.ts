import { boundedString, exactKeys, integer, record, uuid, visibility } from './contracts';

export type ReservationRules = {
  merchantId: string;
  mode: 'shop' | 'staff';
  capacity: number;
  startDate: string;
  endDate: string;
  minimumLeadMinutes: number;
  slotIntervalMinutes: number;
};

export type ReservationStaff = {
  id: string;
  merchantId: string;
  name: string;
  title: string;
  introduction: string;
  visibility: 'draft' | 'visible' | 'hidden' | 'archived';
  sortOrder: number;
  menuIds: string[];
};

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && exactKeys(value, keys) && Reflect.ownKeys(value).length === keys.length;
}

function canonicalUuid(value: unknown): value is string {
  return uuid(value) && value.length === 36 && value === value.toLowerCase();
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function reservationRules(value: unknown): value is ReservationRules {
  try {
    return exactRecord(value, ['merchantId', 'mode', 'capacity', 'startDate', 'endDate', 'minimumLeadMinutes', 'slotIntervalMinutes']) &&
      canonicalUuid(value.merchantId) && (value.mode === 'shop' || value.mode === 'staff') && integer(value.capacity, 1) &&
      calendarDate(value.startDate) && calendarDate(value.endDate) && value.startDate <= value.endDate &&
      integer(value.minimumLeadMinutes) && value.minimumLeadMinutes <= 525600 &&
      integer(value.slotIntervalMinutes, 1) && value.slotIntervalMinutes <= 1440;
  } catch { return false; }
}

export function reservationStaff(value: unknown): value is ReservationStaff {
  try {
    if (!exactRecord(value, ['id', 'merchantId', 'name', 'title', 'introduction', 'visibility', 'sortOrder', 'menuIds']) ||
      !canonicalUuid(value.id) || !canonicalUuid(value.merchantId) || !boundedString(value.name, 120) ||
      !boundedString(value.title, 120) || !boundedString(value.introduction, 1000) || !visibility(value.visibility) ||
      (value.visibility === 'visible' && !value.name.trim()) || !integer(value.sortOrder) ||
      !Array.isArray(value.menuIds) || value.menuIds.length > 1000) return false;
    // Array.from visits sparse entries as undefined, so holes cannot pass validation.
    return Array.from(value.menuIds).every(canonicalUuid) && new Set(value.menuIds).size === value.menuIds.length;
  } catch { return false; }
}

/** Configuration eligibility only; menu ownership and actual availability are checked separately. */
export function eligibleStaff(staff: readonly ReservationStaff[], merchantId: string, menuId: string): ReservationStaff[] {
  if (!canonicalUuid(merchantId)) throw new Error('merchant.invalid');
  if (!canonicalUuid(menuId)) throw new Error('menu.invalid');
  if (!Array.isArray(staff)) throw new Error('staff.invalid');
  for (const member of staff) {
    if (!reservationStaff(member)) throw new Error('staff.invalid');
  }
  return staff.filter((member) => member.merchantId === merchantId && member.visibility === 'visible' && member.menuIds.includes(menuId))
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
