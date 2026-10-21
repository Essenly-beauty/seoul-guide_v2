import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { StorePhonePreview, storeHoursSummary } from '@/components/partner/partner-store-preview';
import type { PartnerSnapshot } from './contracts';
import type { PartnerStoreProfileSnapshot } from './profile-contracts';
import type { MerchantMedia } from './media-contracts';

const at = '2026-10-20T00:00:00.123456Z';
const merchantId = '11111111-1111-4111-8111-111111111111';
const snapshot: PartnerSnapshot = {
  merchant: { id: merchantId, displayName: '저장된 매장', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'], status: 'active', bookingEnabled: true, updatedAt: at },
  categories: [], menus: [], schedule: { merchantId, hours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday, startMinute: 540, endMinute: 1440 })), breaks: [], blocks: [], updatedAt: at },
  reservationRules: null, dateOverrides: [], readOnly: false, loadedAt: at,
};
const data: PartnerStoreProfileSnapshot = {
  profile: { nameKo: '저장된 매장', nameEn: 'Saved Salon', address: '저장된 주소', introductionKo: '저장된 소개', introductionEn: '', contactPhone: '02-123-4567', contactEmail: '', notice: '저장된 안내', englishOk: true, updatedAt: at },
  pendingReview: { id: '22222222-2222-4222-8222-222222222222', fields: { nameEn: 'Unapproved name', address: '미승인 주소' }, createdAt: at, updatedAt: at }, placeId: 'salon',
};
const media = (id: string, status: MerchantMedia['status']): MerchantMedia => ({ id, targetKind: 'store', targetId: null, status, url: `/api/partner/operations/media/${id}/content`, width: 100, height: 100, createdAt: at, updatedAt: at });

describe('saved store preview', () => {
  it('keeps pending text and photos private and accepts versioned schedules', () => {
    const active = media('33333333-3333-4333-8333-333333333333', 'active');
    const pending = media('44444444-4444-4444-8444-444444444444', 'pending');
    const $ = load(renderToStaticMarkup(<StorePhonePreview data={data} snapshot={snapshot} catalog={null} catalogLoading={false} catalogError={false} photos={[active, pending]} />));
    expect($.text()).toContain('Saved Salon');
    expect($.text()).toContain('저장된 주소');
    expect($.text()).not.toMatch(/Unapproved name|미승인 주소/);
    expect($.text()).toContain('변경 검수 중');
    expect($.text()).toContain('09:00–24:00');
    expect($('img')).toHaveLength(1);
    expect($('img').attr('src')).toBe(active.url);
    expect($('a.pv-cta')).toHaveLength(0);
  });

  it('hides the photo area when the venue switched it off, like the customer page (rpc-4)', () => {
    const active = media('33333333-3333-4333-8333-333333333333', 'active');
    const $ = load(renderToStaticMarkup(<StorePhonePreview data={{ ...data, profile: { ...data.profile, showPhotos: false } }} snapshot={snapshot} catalog={null} catalogLoading={false} catalogError={false} photos={[active]} />));
    expect($('.pv-photos')).toHaveLength(0);
    expect($('img')).toHaveLength(0);
    const on = load(renderToStaticMarkup(<StorePhonePreview data={{ ...data, profile: { ...data.profile, showPhotos: true } }} snapshot={snapshot} catalog={null} catalogLoading={false} catalogError={false} photos={[active]} />));
    expect(on('img')).toHaveLength(1);
  });

  it('does not turn unknown photo or booking results into fabricated empty availability', () => {
    const $ = load(renderToStaticMarkup(<StorePhonePreview data={data} snapshot={{ ...snapshot, schedule: null }} catalog={null} catalogLoading={false} catalogError photos={null} />));
    expect($.text()).toContain('운영시간을 설정해 주세요');
    expect($.text()).toContain('매장 사진 조회 중');
    expect($.text()).toContain('Booking information unavailable');
    expect($.text()).not.toContain('공개된 매장 사진 없음');
  });

  it('summarizes consecutive weekdays without changing source hours or losing midnight', () => {
    const schedule = { ...snapshot.schedule!, hours: [{ weekday: 1, startMinute: 540, endMinute: 1440 }, { weekday: 2, startMinute: 540, endMinute: 1440 }, { weekday: 3, startMinute: 540, endMinute: 1440 }] };
    const before = structuredClone(schedule);
    expect(storeHoursSummary({ schedule })).toBe('월–수 09:00–24:00 · 목–일 휴무');
    expect(schedule).toEqual(before);
    expect(storeHoursSummary({ schedule: null })).toBe('운영시간 미설정');
  });
});
