import type { SupabaseClient } from '@supabase/supabase-js';
import { record } from './contracts';
import { getPartnerContext, PartnerError } from './server';
import { BookingError } from '@/lib/booking/server';
import { partnerStoreProfileSnapshot, publicStoreProfile, type PartnerStoreProfileSnapshot, type PublicStoreProfile, type StoreProfileMutation } from './profile-contracts';
import { staffProfile, type StaffProfile, type StaffProfileUpdate, type StaffProfileValues } from './staff-profile-contracts';

const errors: Record<string, number> = { AUTH_REQUIRED: 401, PARTNER_FORBIDDEN: 403, PARTNER_READ_ONLY: 403, INVALID_REQUEST: 400, BOOKING_CONFLICT: 409, STAFF_NOT_FOUND: 404, PROFILE_REVIEW_NOT_FOUND: 404 };
function unavailable(): never { throw new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE'); }
function rpcData(result: unknown): unknown {
  if (!record(result) || !Object.hasOwn(result, 'data') || !Object.hasOwn(result, 'error')) return unavailable();
  if (result.error !== null) {
    if (record(result.error) && result.error.code === 'P0001' && typeof result.error.message === 'string' && Object.hasOwn(errors, result.error.message)) throw new BookingError(errors[result.error.message], result.error.message);
    return unavailable();
  }
  return result.data;
}
async function operation<T>(client: SupabaseClient, write: boolean, run: () => Promise<T>): Promise<T> {
  try {
    const context = await getPartnerContext(client);
    if (write && context.readOnly) throw new BookingError(403, 'PARTNER_READ_ONLY');
    return await run();
  } catch (error) {
    if (error instanceof BookingError) throw error;
    if (error instanceof PartnerError) {
      if (error.code === 'UNAUTHENTICATED') throw new BookingError(401, 'AUTH_REQUIRED');
      if (['PARTNER_UNASSIGNED', 'PARTNER_FORBIDDEN'].includes(error.code)) throw new BookingError(403, 'PARTNER_FORBIDDEN');
    }
    return unavailable();
  }
}
export async function getPartnerStoreProfile(client: SupabaseClient, input?: StoreProfileMutation): Promise<PartnerStoreProfileSnapshot> {
  return operation(client, Boolean(input), async () => {
    const data = rpcData(await client.rpc('partner_store_profile', {
      p_action: input?.action ?? null, p_expected_updated_at: input?.expectedUpdatedAt ?? null,
      p_values: input && 'values' in input ? input.values : null, p_review_id: input?.action === 'cancel_review' ? input.reviewId : null,
    }));
    if (!partnerStoreProfileSnapshot(data)) return unavailable();
    return data;
  });
}
export async function getPublicStoreProfile(client: SupabaseClient, placeId: string): Promise<PublicStoreProfile> {
  try {
    const data = rpcData(await client.rpc('public_store_profile', { p_place_id: placeId }));
    if (!publicStoreProfile(data) || data.placeId !== placeId) return unavailable();
    return data;
  } catch (error) { if (error instanceof BookingError) throw error; return unavailable(); }
}
export async function getPartnerStaffProfile(client: SupabaseClient, id: string, input?: StaffProfileValues | StaffProfileUpdate): Promise<StaffProfile> {
  return operation(client, Boolean(input), async () => {
    const values = input ? { name: input.name, title: input.title, introduction: input.introduction, visibility: input.visibility, sortOrder: input.sortOrder, nameEn: input.nameEn, introductionEn: input.introductionEn } : null;
    const data = rpcData(await client.rpc('partner_staff_profile', {
      p_id: id.toLowerCase(), p_values: values, p_expected_updated_at: input && 'expectedUpdatedAt' in input ? input.expectedUpdatedAt : null,
      p_create: Boolean(input && !('expectedUpdatedAt' in input)),
    }));
    if (!staffProfile(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
