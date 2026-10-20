import { boundedString, exactKeys, integer, record, uuid } from './contracts';
import { bookingTimestamp } from '@/lib/booking/contracts';

export type StaffProfileValues = { name: string; title: string; introduction: string; visibility: 'draft' | 'visible' | 'hidden' | 'archived'; sortOrder: number; nameEn: string; introductionEn: string };
export type StaffProfile = StaffProfileValues & { id: string; updatedAt: string };
export type StaffProfileUpdate = StaffProfileValues & { expectedUpdatedAt: string };
export function staffProfileValues(value: unknown): value is StaffProfileValues {
  return record(value) && exactKeys(value, ['name', 'title', 'introduction', 'visibility', 'sortOrder', 'nameEn', 'introductionEn']) &&
    boundedString(value.name, 120) && boundedString(value.title, 120) && boundedString(value.introduction, 1000) &&
    boundedString(value.nameEn, 120) && boundedString(value.introductionEn, 1000) &&
    ['draft', 'visible', 'hidden', 'archived'].includes(String(value.visibility)) && integer(value.sortOrder, 0) &&
    (value.visibility !== 'visible' || value.name.trim().length > 0);
}
export function staffProfile(value: unknown): value is StaffProfile {
  if (!record(value)) return false;
  const { id, updatedAt, ...values } = value;
  return uuid(id) && bookingTimestamp(updatedAt) && staffProfileValues(values);
}
export function staffProfileUpdate(value: unknown): value is StaffProfileUpdate {
  if (!record(value)) return false;
  const { expectedUpdatedAt, ...values } = value;
  return bookingTimestamp(expectedUpdatedAt) && staffProfileValues(values);
}
