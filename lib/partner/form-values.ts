import { validateMenu, type PartnerCategory, type Visibility } from './catalog';
import { validateSchedule } from './availability';
import { categoryValues, menuValues, scheduleValues, type CategoryValues, type MenuValues, type ScheduleValues, type Schedule, type Category, type Menu } from './contracts';
import { reservationRules, type ReservationRules } from './reservation-config';
import { reservationSchedule, type DateOverride } from './reservation-calendar';
import { reservationJsonbBytes } from './reservation-jsonb';

export type Conversion<T> = { ok: true; values: T } | { ok: false; error: string };
export type CategoryDraft = { nameKo: string; nameEn: string; visibility: Visibility; sortOrder: string };
export type MenuDraft = Omit<MenuValues, 'priceKrw' | 'durationMinutes' | 'cleanupMinutes' | 'sortOrder'> & { priceKrw: string; durationMinutes: string; cleanupMinutes: string; sortOrder: string };
export type WeeklyDraft = { weekday: string; start: string; end: string };
export type BlockDraft = { date: string; start: string; end: string };
export type ScheduleDraft = { hours: WeeklyDraft[]; breaks: WeeklyDraft[]; blocks: BlockDraft[] };
export type ReservationRulesDraft = { mode: 'shop' | 'staff'; capacity: string; startDate: string; endDate: string; minimumLeadMinutes: string; slotIntervalMinutes: string };
export type SpecialPeriodDraft = { start: string; end: string };
export type DateOverrideDraft = { date: string; closed: boolean; hours: SpecialPeriodDraft[]; breaks: SpecialPeriodDraft[] };

export function parseOptionalInteger(value: string): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}
export function parseMinute(value: string, end = false): number | null {
  if (end && value === '24:00') return 1440;
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}
export function formatMinute(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function categoryDraft(category?: Category): CategoryDraft {
  return { nameKo: category?.nameKo ?? '', nameEn: category?.nameEn ?? '', visibility: category?.visibility ?? 'draft', sortOrder: String(category?.sortOrder ?? 0) };
}
export function menuDraft(menu?: Menu, categoryId = ''): MenuDraft {
  return { categoryId: menu?.categoryId ?? categoryId, nameKo: menu?.nameKo ?? '', nameEn: menu?.nameEn ?? '', descriptionKo: menu?.descriptionKo ?? '', descriptionEn: menu?.descriptionEn ?? '', priceKrw: menu?.priceKrw?.toString() ?? '', durationMinutes: menu?.durationMinutes?.toString() ?? '', cleanupMinutes: String(menu?.cleanupMinutes ?? 0), visibility: menu?.visibility ?? 'draft', sortOrder: String(menu?.sortOrder ?? 0) };
}
export function scheduleDraft(schedule: Schedule | null): ScheduleDraft {
  const weekly = ({ weekday, startMinute, endMinute }: ScheduleValues['hours'][number]) => ({ weekday: String(weekday), start: formatMinute(startMinute), end: formatMinute(endMinute) });
  return { hours: schedule?.hours.map(weekly) ?? [], breaks: schedule?.breaks.map(weekly) ?? [], blocks: schedule?.blocks.map(({ date, startMinute, endMinute }) => ({ date, start: formatMinute(startMinute), end: formatMinute(endMinute) })) ?? [] };
}
export function reservationRulesDraft(rules: (ReservationRules & { updatedAt: string }) | null): ReservationRulesDraft {
  return { mode: rules?.mode ?? 'shop', capacity: rules ? String(rules.capacity) : '', startDate: rules?.startDate ?? '', endDate: rules?.endDate ?? '', minimumLeadMinutes: rules ? String(rules.minimumLeadMinutes) : '', slotIntervalMinutes: rules ? String(rules.slotIntervalMinutes) : '' };
}
export function dateOverridesDraft(overrides: readonly DateOverride[]): DateOverrideDraft[] {
  const period = ({ startMinute, endMinute }: DateOverride['hours'][number]) => ({ start: formatMinute(startMinute), end: formatMinute(endMinute) });
  return overrides.map(({ date, hours, breaks }) => ({ date, closed: hours.length === 0, hours: hours.map(period), breaks: breaks.map(period) }));
}
export function categoryFormValues(draft: CategoryDraft): Conversion<CategoryValues> {
  const values = { ...draft, sortOrder: parseOptionalInteger(draft.sortOrder) };
  return categoryValues(values) ? { ok: true, values } : { ok: false, error: '카테고리명은 각 120자 이내로, 표시 순서는 0 이상의 정수로 입력해 주세요.' };
}
export function menuFormValues(draft: MenuDraft, merchantId: string, categories: readonly PartnerCategory[], depositKrw: number | null): Conversion<MenuValues> {
  const values = { ...draft, priceKrw: parseOptionalInteger(draft.priceKrw), durationMinutes: parseOptionalInteger(draft.durationMinutes), cleanupMinutes: parseOptionalInteger(draft.cleanupMinutes), sortOrder: parseOptionalInteger(draft.sortOrder) };
  if (!categories.some((category) => category.id === draft.categoryId && category.merchantId === merchantId)) return { ok: false, error: '이 매장의 카테고리를 선택해 주세요. 카테고리가 없으면 먼저 추가해 주세요.' };
  if (!menuValues(values)) return { ok: false, error: '총 금액과 시술 시간은 비워 두거나 1 이상의 정수로, 정리 시간과 표시 순서는 0 이상의 정수로 입력해 주세요. 이름은 120자, 설명은 4,000자까지 입력할 수 있습니다.' };
  if (validateMenu({ ...values, id: 'draft', merchantId, depositKrw }, categories).length) return { ok: false, error: '총 금액은 승인된 예약금 이상이어야 합니다.' };
  return { ok: true, values };
}
export function scheduleFormValues(draft: ScheduleDraft, overrides: readonly DateOverride[] = []): Conversion<ScheduleValues> {
  if (draft.hours.length > 128 || draft.breaks.length > 128 || draft.blocks.length > 512) return { ok: false, error: '영업시간과 휴게시간은 각각 128개, 날짜별 휴무는 512개까지 등록할 수 있습니다.' };
  const weekly = (row: WeeklyDraft) => ({ weekday: parseOptionalInteger(row.weekday), startMinute: parseMinute(row.start), endMinute: parseMinute(row.end, true) });
  const values = { hours: draft.hours.map(weekly), breaks: draft.breaks.map(weekly), blocks: draft.blocks.map((row) => ({ date: row.date, startMinute: parseMinute(row.start), endMinute: parseMinute(row.end, true) })) };
  if ([...values.hours, ...values.breaks, ...values.blocks].some((row) => row.startMinute === null || row.endMinute === null) || [...values.hours, ...values.breaks].some((row) => row.weekday === null || row.weekday === undefined)) return { ok: false, error: '요일과 시간을 모두 입력해 주세요. 시간 형식은 09:00이며, 24:00은 종료 시간에만 사용할 수 있습니다.' };
  // Values with nulls have been rejected above; the shared validator checks bounds, dates and overlaps.
  const errors = validateSchedule({ ...values, merchantId: 'draft' } as Parameters<typeof validateSchedule>[0]);
  if (errors.some((error) => error.endsWith('.overlap'))) return { ok: false, error: '같은 요일 또는 날짜의 시간대가 겹칩니다. 겹치는 구간을 수정해 주세요.' };
  if (errors.includes('breaks.outside_hours')) return { ok: false, error: '휴게시간은 같은 요일의 영업시간 안에 있어야 합니다.' };
  if (!scheduleValues(values)) return { ok: false, error: '날짜와 시간 범위를 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 하며, 자정을 넘는 영업은 요일별로 나누어 입력해 주세요.' };
  if (reservationJsonbBytes({ ...values, overrides } as Parameters<typeof reservationJsonbBytes>[0]) > 262144) return { ok: false, error: '전체 일정과 특별 영업일의 저장 크기가 256KB를 넘습니다. 기간을 줄여 주세요.' };
  return { ok: true, values };
}
export function reservationRulesFormValues(draft: ReservationRulesDraft, merchantId: string): Conversion<Omit<ReservationRules, 'merchantId'>> {
  const values = { mode: draft.mode, capacity: parseOptionalInteger(draft.capacity), startDate: draft.startDate, endDate: draft.endDate, minimumLeadMinutes: parseOptionalInteger(draft.minimumLeadMinutes), slotIntervalMinutes: parseOptionalInteger(draft.slotIntervalMinutes) };
  if (!reservationRules({ ...values, merchantId })) return { ok: false, error: '매장 동시 수용 수, 시작·종료 날짜, 사전 예약 시간과 시작 간격을 확인해 주세요. 숫자 항목은 빈칸 없이 정수로 입력해 주세요.' };
  return { ok: true, values: values as Omit<ReservationRules, 'merchantId'> };
}
export function dateOverridesFormValues(draft: readonly DateOverrideDraft[], merchantId: string, schedule: Pick<Schedule, 'hours' | 'breaks' | 'blocks'> | null): Conversion<{ overrides: DateOverride[] }> {
  if (draft.length > 366) return { ok: false, error: '특별 영업일은 366일까지 등록할 수 있습니다.' };
  if (draft.some((day) => !day.closed && day.hours.length === 0)) return { ok: false, error: '특별 영업일의 영업시간을 추가하거나 종일 휴무를 선택해 주세요.' };
  if (draft.some((day) => day.hours.length > 128 || day.breaks.length > 128)) return { ok: false, error: '하루의 영업시간과 휴게시간은 각각 128개까지 등록할 수 있습니다.' };
  const period = (row: SpecialPeriodDraft) => ({ startMinute: parseMinute(row.start), endMinute: parseMinute(row.end, true) });
  const overrides = draft.map(({ date, closed, hours, breaks }) => ({ date, hours: closed ? [] : hours.map(period), breaks: closed ? [] : breaks.map(period) }));
  if (overrides.some((day) => [...day.hours, ...day.breaks].some((row) => row.startMinute === null || row.endMinute === null))) return { ok: false, error: '시간을 09:00 형식으로 입력해 주세요. 24:00은 종료 시간에만 사용할 수 있습니다.' };
  const base = { hours: schedule?.hours ?? [], breaks: schedule?.breaks ?? [], blocks: schedule?.blocks ?? [] };
  if (reservationJsonbBytes({ ...base, overrides } as Parameters<typeof reservationJsonbBytes>[0]) > 262144) return { ok: false, error: '전체 일정과 특별 영업일의 저장 크기가 256KB를 넘습니다. 기간을 줄여 주세요.' };
  // Historical admin block dates in year 0000 remain in the stored weekly row
  // and byte count, but are intentionally excluded from the booking contract.
  const combined = { merchantId, ...base, blocks: base.blocks.filter((block) => !block.date.startsWith('0000-')), overrides };
  if (!reservationSchedule(combined)) return { ok: false, error: '특별 영업일의 날짜와 시간대를 확인해 주세요. 날짜가 겹치지 않아야 하고, 휴게시간은 영업시간 안에 있어야 합니다.' };
  return { ok: true, values: { overrides: combined.overrides } };
}
