import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { storeInstantDraft, storeInstantValues, type PartnerStoreProfileSnapshot } from './profile-contracts';

const profile = { contactPhone: '02-1234-5678', contactEmail: '', englishOk: true, notice: '', nameKo: 'Salon', nameEn: '', address: 'Seoul', introductionKo: '', introductionEn: '', updatedAt: '2026-10-20T10:00:00.123456+00:00' };
const snap = (extra: object): PartnerStoreProfileSnapshot => ({ profile: { ...profile, ...extra }, pendingReview: null, placeId: 'known' });

describe('rpc-4: the photo switch is sent and shown only when the server reported it', () => {
  it('a database without show_photos gets the legacy 4-key save', () => {
    const draft = storeInstantDraft(snap({}));
    expect(Object.keys(draft).sort()).toEqual(['contactEmail', 'contactPhone', 'englishOk', 'notice']);
    expect(storeInstantValues(draft)).toBe(true);
  });
  it('a database with show_photos round-trips the switch', () => {
    expect(storeInstantDraft(snap({ showPhotos: false }))).toMatchObject({ showPhotos: false });
    expect(storeInstantValues(storeInstantDraft(snap({ showPhotos: true })))).toBe(true);
  });
  it('the editor renders the switch only for a 5-key snapshot', () => {
    const src = readFileSync(new URL('../../components/partner/partner-store-profile.tsx', import.meta.url), 'utf8');
    expect(src).toContain('latest.profile.showPhotos!==undefined&&<li>');
    expect(src).toContain('const instant=storeInstantDraft;');
  });
});
