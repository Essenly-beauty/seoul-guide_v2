import { boundedString, exactKeys, record, uuid } from './contracts';
import { bookingTimestamp } from '@/lib/booking/contracts';

export type StoreInstantValues = { contactPhone: string; contactEmail: string; englishOk: boolean; notice: string };
export type StoreReviewValues = { nameKo: string; nameEn: string; address: string; introductionKo: string; introductionEn: string };
export type StoreProfile = StoreInstantValues & StoreReviewValues & { updatedAt: string };
export type StoreProfileReview = { id: string; fields: Partial<StoreReviewValues>; createdAt: string; updatedAt: string };
export type PartnerStoreProfileSnapshot = { profile: StoreProfile; pendingReview: StoreProfileReview | null; placeId: string | null };
export type StoreProfileMutation =
  | { action: 'update'; expectedUpdatedAt: string; values: StoreInstantValues }
  | { action: 'request_review'; expectedUpdatedAt: string; values: StoreReviewValues }
  | { action: 'cancel_review'; expectedUpdatedAt: string; reviewId: string };
export type PublicStoreProfile = { status: 'unpublished'; placeId: string } | { status: 'published'; placeId: string; profile: StoreProfile };

const reviewKeys = ['nameKo', 'nameEn', 'address', 'introductionKo', 'introductionEn'] as const;
function placeId(value: unknown): value is string { return boundedString(value, 200) && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value); }
export function storeInstantValues(value: unknown): value is StoreInstantValues {
  return record(value) && exactKeys(value, ['contactPhone', 'contactEmail', 'englishOk', 'notice']) &&
    boundedString(value.contactPhone, 80) && (value.contactPhone === '' || /^[+\d(). -]+$/.test(value.contactPhone)) &&
    boundedString(value.contactEmail, 254) && (value.contactEmail === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail)) &&
    typeof value.englishOk === 'boolean' && boundedString(value.notice, 60);
}
export function storeReviewValues(value: unknown): value is StoreReviewValues {
  return record(value) && exactKeys(value, reviewKeys) && boundedString(value.nameKo, 120) && value.nameKo.trim().length > 0 &&
    boundedString(value.nameEn, 120) && boundedString(value.address, 500) &&
    boundedString(value.introductionKo, 4000) && boundedString(value.introductionEn, 4000);
}
export function storeProfile(value: unknown): value is StoreProfile {
  if (!record(value)) return false;
  const { updatedAt, nameKo, nameEn, address, introductionKo, introductionEn, ...instant } = value;
  return bookingTimestamp(updatedAt) && storeReviewValues({ nameKo, nameEn, address, introductionKo, introductionEn }) && storeInstantValues(instant);
}
function review(value: unknown): value is StoreProfileReview {
  if (!record(value) || !exactKeys(value, ['id', 'fields', 'createdAt', 'updatedAt']) || !uuid(value.id) ||
    !bookingTimestamp(value.createdAt) || !bookingTimestamp(value.updatedAt) || !record(value.fields) || Object.keys(value.fields).length === 0 ||
    Object.keys(value.fields).some((key) => !reviewKeys.includes(key as typeof reviewKeys[number]))) return false;
  return storeReviewValues({ nameKo: 'placeholder', nameEn: '', address: '', introductionKo: '', introductionEn: '', ...value.fields });
}
export function partnerStoreProfileSnapshot(value: unknown): value is PartnerStoreProfileSnapshot {
  return record(value) && exactKeys(value, ['profile', 'pendingReview', 'placeId']) && storeProfile(value.profile) &&
    (value.pendingReview === null || review(value.pendingReview)) && (value.placeId === null || placeId(value.placeId));
}
export function storeProfileMutation(value: unknown): value is StoreProfileMutation {
  if (!record(value) || !bookingTimestamp(value.expectedUpdatedAt)) return false;
  if (value.action === 'cancel_review') return exactKeys(value, ['action', 'expectedUpdatedAt', 'reviewId']) && uuid(value.reviewId);
  return exactKeys(value, ['action', 'expectedUpdatedAt', 'values']) &&
    ((value.action === 'update' && storeInstantValues(value.values)) || (value.action === 'request_review' && storeReviewValues(value.values)));
}
export function publicStoreProfile(value: unknown): value is PublicStoreProfile {
  return record(value) && placeId(value.placeId) && (value.status === 'unpublished' ? exactKeys(value, ['status', 'placeId']) :
    value.status === 'published' && exactKeys(value, ['status', 'placeId', 'profile']) && storeProfile(value.profile));
}
