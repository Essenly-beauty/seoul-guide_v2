import type { SupabaseClient } from '@supabase/supabase-js';
import { integer, record, uuid, type PartnerCommand } from './contracts';
import { categoryColumns, decodeCategory, PartnerError, partnerOperation, queryData, unavailable, type PartnerContext } from './server';
export async function savePartnerCommand(client: SupabaseClient, context: PartnerContext, command: PartnerCommand): Promise<void> {
  return partnerOperation(async () => {
    if (context.readOnly || !['onboarding', 'active'].includes(context.merchant.status)) throw new PartnerError(403, 'PARTNER_READ_ONLY');
    const merchantId = context.merchant.id;
    let table: string;
    let values: Record<string, unknown>;
    let key: string;
    let id: string;
    if (command.kind === 'category') {
      table = 'merchant_categories'; key = 'id'; id = command.id;
      values = { name_ko: command.values.nameKo, name_en: command.values.nameEn, visibility: command.values.visibility, sort_order: command.values.sortOrder };
    } else if (command.kind === 'menu') {
      table = 'merchant_services'; key = 'id'; id = command.id;
      const category = queryData(await client.from('merchant_categories').select(categoryColumns).eq('id', command.values.categoryId).eq('merchant_id', merchantId).maybeSingle());
      if (category === null || (record(category) && category.merchant_id !== merchantId)) throw new PartnerError(403, 'PARTNER_FORBIDDEN');
      const ownedCategory = decodeCategory(category, merchantId);
      if (ownedCategory.id.toLowerCase() !== command.values.categoryId.toLowerCase()) return unavailable();
      if (command.mode === 'update') {
        const existing = queryData(await client.from('merchant_services').select('id,merchant_id,deposit_krw').eq('id', id).eq('merchant_id', merchantId).maybeSingle());
        if (existing === null) throw new PartnerError(409, 'PARTNER_CONFLICT');
        if (!record(existing) || !uuid(existing.id) || existing.id.toLowerCase() !== id.toLowerCase() || existing.merchant_id !== merchantId || !(existing.deposit_krw === null || integer(existing.deposit_krw, 1))) return unavailable();
        if (existing.deposit_krw !== null && command.values.priceKrw !== null && command.values.priceKrw < existing.deposit_krw) throw new PartnerError(400, 'INVALID_COMMAND');
      }
      const value = command.values;
      values = { category_id: value.categoryId, name_ko: value.nameKo, name_en: value.nameEn, description_ko: value.descriptionKo, description_en: value.descriptionEn, price_krw: value.priceKrw, duration_minutes: value.durationMinutes, cleanup_minutes: value.cleanupMinutes, visibility: value.visibility, sort_order: value.sortOrder };
    } else if (command.kind === 'schedule') {
      table = 'merchant_schedules'; key = 'merchant_id'; id = merchantId;
      values = { hours: command.values.hours, breaks: command.values.breaks, blocks: command.values.blocks };
    } else {
      throw new PartnerError(400, 'INVALID_COMMAND');
    }
    const query = command.mode === 'create'
      ? client.from(table).insert({ ...values, ...(key === 'id' ? { id } : {}), merchant_id: merchantId })
      : client.from(table).update(values).eq(key, id).eq('merchant_id', merchantId).eq('updated_at', command.expectedUpdatedAt);
    const result: unknown = await query.select(key).maybeSingle();
    if (!record(result)) return unavailable();
    if (result.error !== null) {
      if (record(result.error)) {
        if (result.error.code === '23505') throw new PartnerError(409, 'PARTNER_CONFLICT');
        if (result.error.code === '42501') throw new PartnerError(403, 'PARTNER_FORBIDDEN');
        // A constraint can change between the read and write (for example an operator's deposit approval).
        if (result.error.code === '23514' || result.error.code === '23503') throw new PartnerError(409, 'PARTNER_CONFLICT');
      }
      return unavailable();
    }
    if (result.data === null) throw new PartnerError(409, 'PARTNER_CONFLICT');
    if (!record(result.data)) return unavailable();
    const acceptedId = result.data[key];
    if (!uuid(acceptedId) || acceptedId.toLowerCase() !== id.toLowerCase()) return unavailable();
  });
}
