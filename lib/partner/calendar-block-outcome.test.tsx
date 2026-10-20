import type { FormEvent, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerSnapshot } from './contracts';

const mock = vi.hoisted(() => ({ save: vi.fn(), operation: null as (() => Promise<unknown>) | null }));
vi.mock('@/components/partner/partner-provider', async importOriginal => ({
  ...await importOriginal<typeof import('@/components/partner/partner-provider')>(),
  usePartner: () => ({ snapshot, stale: false, save: mock.save, refresh: vi.fn() }),
}));
vi.mock('@/components/booking/use-booking-resource', () => ({ useBookingResource: () => ({ data: null, error: '', loading: false, refresh: vi.fn() }) }));
vi.mock('@/components/partner/use-operation-draft', () => ({
  useOperationDraft: (_key: string, initial: { values: Record<string, string>; updatedAt: string }) => ({
    draft: { ...initial, values: { ...initial.values, end: '11:00' } }, state: { kind: 'idle' }, locked: false,
    setDraft: vi.fn(), recover: vi.fn(), commit: (operation: () => Promise<unknown>) => { mock.operation = operation; },
  }),
}));
import { CalendarBlockEditor } from '@/components/partner/partner-calendar-block';
import { uncertainSaveOutcomeMessage } from '@/components/partner/partner-provider';

const at = '2026-10-20T00:00:00.123456Z';
const merchantId = '11111111-1111-4111-8111-111111111111';
const snapshot: PartnerSnapshot = {
  merchant: { id: merchantId, displayName: '매장', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'], status: 'active', bookingEnabled: true, updatedAt: at },
  categories: [], menus: [], schedule: { merchantId, hours: [{ weekday: 2, startMinute: 540, endMinute: 1200 }], breaks: [], blocks: [], updatedAt: at },
  reservationRules: null, dateOverrides: [], readOnly: false, loadedAt: at,
};

function submitBlock(onSaved = vi.fn()) {
  const tree = CalendarBlockEditor({ point: { date: '2026-10-20', startAt: '2026-10-20T10:00:00+09:00', staffId: null }, staff: [], closure: false, scope: `user:${merchantId}`, onClose: vi.fn(), onSaved });
  const form = tree.props.children as ReactElement<{ onSubmit: (event: FormEvent) => void }>;
  form.props.onSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
  return { operation: mock.operation!, onSaved };
}

beforeEach(() => { mock.save.mockReset(); mock.operation = null; });

describe('calendar block write outcome recovery', () => {
  it('keeps a lost-response save in the recovery-required path instead of reporting an input error', async () => {
    mock.save.mockResolvedValue({ kind: 'error', message: uncertainSaveOutcomeMessage });
    const { operation, onSaved } = submitBlock();
    await expect(operation()).rejects.toThrow('BOOKING_SERVICE_UNAVAILABLE');
    expect(onSaved).not.toHaveBeenCalled();
    expect(mock.save).toHaveBeenCalledWith({ kind: 'schedule', mode: 'update', expectedUpdatedAt: at, values: { hours: snapshot.schedule!.hours, breaks: [], blocks: [{ date: '2026-10-20', startMinute: 600, endMinute: 660 }] } });
  });

  it('keeps acknowledged writes with failed readback locked for recovery', async () => {
    mock.save.mockResolvedValue({ kind: 'committed-stale' });
    const { operation, onSaved } = submitBlock();
    await expect(operation()).rejects.toThrow('BOOKING_SERVICE_UNAVAILABLE');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('allows correction for a definite validation rejection and retains conflict handling', async () => {
    mock.save.mockResolvedValueOnce({ kind: 'error', message: '입력한 값이 저장 조건에 맞지 않습니다.' }).mockResolvedValueOnce({ kind: 'conflict', message: '최신 설정을 확인해 주세요.' });
    await expect(submitBlock().operation()).rejects.toThrow('INVALID_REQUEST');
    await expect(submitBlock().operation()).rejects.toThrow('BOOKING_CONFLICT');
  });

  it('reports success only when the provider returns the confirmed saved snapshot', async () => {
    mock.save.mockResolvedValue({ kind: 'saved', snapshot });
    const { operation, onSaved } = submitBlock();
    await expect(operation()).resolves.toMatchObject({ updatedAt: at });
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
