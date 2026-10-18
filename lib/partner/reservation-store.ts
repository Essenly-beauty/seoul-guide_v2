import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReservationCommand } from './reservation-commands';
import { record, uuid } from './contracts';
import { PartnerError, partnerOperation, unavailable, type PartnerContext } from './server';

export async function saveReservationCommand(client: SupabaseClient, context: PartnerContext, command: ReservationCommand): Promise<void> {
  return partnerOperation(async () => {
    if ((command.kind !== 'reservationRules' && command.kind !== 'dateOverrides') ||
      (command.mode !== 'create' && command.mode !== 'update')) throw new PartnerError(400, 'INVALID_COMMAND');
    if (context.readOnly || !['onboarding', 'active'].includes(context.merchant.status)) throw new PartnerError(403, 'PARTNER_READ_ONLY');
    if (context.merchant.bookingEnabled) throw new PartnerError(409, 'PARTNER_CONFLICT');
    const merchantId = context.merchant.id;
    if (!uuid(merchantId)) return unavailable();
    const table = command.kind === 'reservationRules' ? 'merchant_reservation_rules' : 'merchant_schedules';
    const values = command.kind === 'reservationRules' ? {
      mode: command.values.mode, capacity: command.values.capacity,
      start_date: command.values.startDate, end_date: command.values.endDate,
      minimum_lead_minutes: command.values.minimumLeadMinutes, slot_interval_minutes: command.values.slotIntervalMinutes,
    } : { overrides: command.values.overrides };
    const query = command.mode === 'create'
      ? client.from(table).insert({ merchant_id: merchantId, ...(
        command.kind === 'dateOverrides' ? { hours: [], breaks: [], blocks: [] } : {}), ...values })
      : client.from(table).update(values).eq('merchant_id', merchantId).eq('updated_at', command.expectedUpdatedAt);
    const result: unknown = await query.select('merchant_id').maybeSingle();
    if (!record(result)) return unavailable();
    if (result.error !== null) {
      if (record(result.error)) {
        if (['23505', '23514', '23503'].includes(String(result.error.code))) throw new PartnerError(409, 'PARTNER_CONFLICT');
        if (result.error.code === '42501') throw new PartnerError(403, 'PARTNER_FORBIDDEN');
      }
      return unavailable();
    }
    if (result.data === null) throw new PartnerError(409, 'PARTNER_CONFLICT');
    if (!record(result.data) || !uuid(result.data.merchant_id) || result.data.merchant_id.toLowerCase() !== merchantId.toLowerCase()) return unavailable();
  });
}
