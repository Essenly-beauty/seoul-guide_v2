import { reservationStaff } from './reservation-config';
import { reservationSchedule } from './reservation-calendar';
import { dateOverridesDraft, dateOverridesFormValues, parseOptionalInteger, scheduleDraft, scheduleFormValues, type Conversion, type DateOverrideDraft, type ScheduleDraft } from './form-values';
import type { StaffCalendar, StaffDetail } from './staff-server';
import type { StaffProfileValues, StaffScheduleValues } from './staff-contracts';

const placeholder = '00000000-0000-0000-0000-000000000000';

export type StaffProfileDraft = Omit<StaffProfileValues, 'sortOrder'> & { sortOrder: string };
export type StaffCalendarDraft = { weekly: ScheduleDraft; overrides: DateOverrideDraft[] };

export function staffProfileDraft(staff?: StaffDetail): StaffProfileDraft {
  return {
    name: staff?.name ?? '', title: staff?.title ?? '', introduction: staff?.introduction ?? '',
    visibility: staff?.visibility ?? 'draft', sortOrder: String(staff?.sortOrder ?? 0),
  };
}

export function staffProfileFormValues(draft: StaffProfileDraft): Conversion<StaffProfileValues> {
  const values = { ...draft, sortOrder: parseOptionalInteger(draft.sortOrder) };
  if (!reservationStaff({ id: placeholder, merchantId: placeholder, ...values, menuIds: [] })) {
    return { ok: false, error: '이름·직함은 각 120자, 소개는 1,000자 이내로 입력해 주세요. 표시 순서는 0 이상의 정수이며, 공개 준비에는 이름이 필요합니다.' };
  }
  return { ok: true, values: values as StaffProfileValues };
}

export function staffCalendarDraft(calendar: StaffCalendar | null): StaffCalendarDraft {
  return { weekly: scheduleDraft(calendar), overrides: dateOverridesDraft(calendar?.overrides ?? []) };
}

export function staffCalendarFormValues(draft: StaffCalendarDraft, merchantId: string): Conversion<StaffScheduleValues> {
  const weekly = scheduleFormValues(draft.weekly);
  if (!weekly.ok) return weekly;
  const dates = dateOverridesFormValues(draft.overrides, merchantId, weekly.values);
  if (!dates.ok) return dates;
  const values = { ...weekly.values, ...dates.values };
  if (!reservationSchedule({ merchantId, ...values })) return { ok: false, error: '담당자 근무 날짜와 시간대를 확인해 주세요. 겹치는 시간이나 유효하지 않은 날짜는 저장할 수 없습니다.' };
  return { ok: true, values };
}
