import { describe, expect, it } from 'vitest';
import { menuReadiness, publicMenu, validateMenu, type PartnerCategory, type PartnerMenu, type Visibility } from './catalog';

const category: PartnerCategory = { id: 'category', merchantId: 'merchant', nameKo: '관리', nameEn: 'Care', visibility: 'visible', sortOrder: 0 };
const menu: PartnerMenu = {
  id: 'menu', merchantId: 'merchant', categoryId: category.id,
  nameKo: '관리', nameEn: ' Care ', descriptionKo: '관리 설명', descriptionEn: ' Care description ',
  priceKrw: 50000, depositKrw: 10000, durationMinutes: 60, cleanupMinutes: 10,
  visibility: 'visible', sortOrder: 0,
};

describe('partner catalog', () => {
  it('validates a complete menu and projects only public fields without mutation', () => {
    const input = { ...menu, internalNotes: 'private', other: 'secret' };
    const before = structuredClone(input);
    expect(validateMenu(input, [category])).toEqual([]);
    expect(menuReadiness(input, [category])).toEqual([]);
    expect(publicMenu(input, [category], 'merchant', true)).toEqual({
      id: 'menu', merchantId: 'merchant', categoryId: 'category', name: 'Care', description: 'Care description',
      currency: 'KRW', priceKrw: 50000, depositKrw: 10000, balanceKrw: 40000, durationMinutes: 60, cleanupMinutes: 10,
    });
    expect(input).toEqual(before);
  });

  it('allows incomplete drafts to save but requires every publication field', () => {
    const draft = { ...menu, visibility: 'draft' as const, nameKo: '', nameEn: '', descriptionKo: '', descriptionEn: '', priceKrw: null, depositKrw: null, durationMinutes: null };
    expect(validateMenu(draft, [category])).toEqual([]);
    expect(menuReadiness(draft, [category])).toEqual(expect.arrayContaining([
      'nameKo.required', 'nameEn.required', 'descriptionKo.required', 'descriptionEn.required',
      'priceKrw.required', 'depositKrw.required', 'durationMinutes.required', 'menu.not_visible',
    ]));
    expect(publicMenu(draft, [category], 'merchant', true)).toBeNull();
  });

  it.each(['priceKrw', 'depositKrw', 'durationMinutes'] as const)('rejects invalid positive integer %s', (field) => {
    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(validateMenu({ ...menu, [field]: value }, [category])).toContain(`${field}.invalid`);
    }
  });

  it('rejects a deposit above price and permits equal price and deposit', () => {
    expect(validateMenu({ ...menu, depositKrw: 50001 }, [category])).toContain('depositKrw.exceeds_price');
    expect(publicMenu({ ...menu, depositKrw: 50000 }, [category], 'merchant', true)?.balanceKrw).toBe(0);
  });

  it.each(['id', 'merchantId', 'categoryId'] as const)('rejects blank %s', (field) => {
    expect(validateMenu({ ...menu, [field]: ' ' }, [category])).toContain(`${field}.invalid`);
  });

  it.each(['nameKo', 'nameEn', 'descriptionKo', 'descriptionEn'] as const)('checks text bounds and required %s', (field) => {
    const limit = field.startsWith('name') ? 120 : 4000;
    expect(validateMenu({ ...menu, [field]: 'a'.repeat(limit) }, [category])).toEqual([]);
    expect(validateMenu({ ...menu, [field]: 'a'.repeat(limit + 1) }, [category])).toContain(`${field}.invalid`);
    expect(menuReadiness({ ...menu, [field]: ' ' }, [category])).toContain(`${field}.required`);
    expect(publicMenu({ ...menu, [field]: ' ' }, [category], 'merchant', true)).toBeNull();
  });

  it.each(['cleanupMinutes', 'sortOrder'] as const)('requires nonnegative safe integer %s', (field) => {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(validateMenu({ ...menu, [field]: value }, [category])).toContain(`${field}.invalid`);
    }
    expect(validateMenu({ ...menu, [field]: 0 }, [category])).toEqual([]);
  });

  it.each(['nameKo', 'nameEn', 'descriptionKo', 'descriptionEn'] as const)('counts Unicode code points for %s bounds', (field) => {
    const limit = field.startsWith('name') ? 120 : 4000;
    expect(validateMenu({ ...menu, [field]: '😀'.repeat(limit) }, [category])).toEqual([]);
    expect(validateMenu({ ...menu, [field]: '😀'.repeat(limit + 1) }, [category])).toContain(`${field}.invalid`);
  });

  it('rejects invalid visibility', () => {
    expect(validateMenu({ ...menu, visibility: 'invalid' as Visibility }, [category])).toContain('visibility.invalid');
  });

  it('rejects missing or foreign categories', () => {
    for (const categories of [[], [{ ...category, merchantId: 'foreign' }]]) {
      expect(validateMenu(menu, categories)).toContain('category.invalid');
      expect(menuReadiness(menu, categories)).toContain('category.not_visible');
      expect(publicMenu(menu, categories, 'merchant', true)).toBeNull();
    }
  });

  it.each(['draft', 'hidden', 'archived'] as const)('excludes %s menus and categories', (visibility) => {
    expect(menuReadiness({ ...menu, visibility }, [category])).toContain('menu.not_visible');
    expect(publicMenu({ ...menu, visibility }, [category], 'merchant', true)).toBeNull();
    expect(menuReadiness(menu, [{ ...category, visibility }])).toContain('category.not_visible');
    expect(publicMenu(menu, [{ ...category, visibility }], 'merchant', true)).toBeNull();
  });

  it('requires a matching merchant and an enabled booking gate', () => {
    expect(publicMenu(menu, [category], 'foreign', true)).toBeNull();
    expect(publicMenu(menu, [category], 'merchant', false)).toBeNull();
  });
});
