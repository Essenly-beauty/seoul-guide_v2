export type Visibility = 'draft' | 'visible' | 'hidden' | 'archived';
export type PartnerCategory = {
  id: string; merchantId: string; nameKo: string; nameEn: string;
  visibility: Visibility; sortOrder: number;
};
export type PartnerMenu = {
  id: string; merchantId: string; categoryId: string;
  nameKo: string; nameEn: string; descriptionKo: string; descriptionEn: string;
  priceKrw: number | null; depositKrw: number | null; durationMinutes: number | null;
  cleanupMinutes: number; visibility: Visibility; sortOrder: number;
};

export function validateMenu(menu: PartnerMenu, categories: readonly PartnerCategory[]): string[] {
  const errors: string[] = [];
  for (const field of ['id', 'merchantId', 'categoryId'] as const) {
    if (typeof menu[field] !== 'string' || !menu[field].trim()) errors.push(`${field}.invalid`);
  }
  for (const field of ['nameKo', 'nameEn', 'descriptionKo', 'descriptionEn'] as const) {
    // Match PostgreSQL length(text) by counting Unicode code points.
    if (typeof menu[field] !== 'string' || Array.from(menu[field]).length > (field.startsWith('name') ? 120 : 4000)) errors.push(`${field}.invalid`);
  }
  for (const field of ['priceKrw', 'depositKrw', 'durationMinutes'] as const) {
    const value = menu[field];
    if (value !== null && (!Number.isSafeInteger(value) || value <= 0)) errors.push(`${field}.invalid`);
  }
  for (const field of ['cleanupMinutes', 'sortOrder'] as const) {
    if (!Number.isSafeInteger(menu[field]) || menu[field] < 0) errors.push(`${field}.invalid`);
  }
  if (!(['draft', 'visible', 'hidden', 'archived'] as const).includes(menu.visibility)) errors.push('visibility.invalid');
  if (menu.depositKrw !== null && menu.priceKrw !== null && menu.depositKrw > menu.priceKrw) errors.push('depositKrw.exceeds_price');
  if (!categories.some((category) => category.id === menu.categoryId && category.merchantId === menu.merchantId)) errors.push('category.invalid');
  return errors;
}

export function menuReadiness(menu: PartnerMenu, categories: readonly PartnerCategory[], options: { paymentMode?: 'pay_at_venue' } = {}): string[] {
  const errors = validateMenu(menu, categories);
  for (const field of ['nameKo', 'nameEn', 'descriptionKo', 'descriptionEn'] as const) {
    if (typeof menu[field] !== 'string' || !menu[field].trim()) errors.push(`${field}.required`);
  }
  for (const field of ['priceKrw', 'depositKrw', 'durationMinutes'] as const) {
    // The live booking flow collects the full amount at the venue. Keep the
    // default deposit-backed projection strict for its existing callers.
    if (field === 'depositKrw' && options.paymentMode === 'pay_at_venue') continue;
    if (menu[field] === null) errors.push(`${field}.required`);
  }
  if (menu.visibility !== 'visible') errors.push('menu.not_visible');
  if (!categories.some((category) => category.id === menu.categoryId && category.merchantId === menu.merchantId && category.visibility === 'visible')) errors.push('category.not_visible');
  return errors;
}

/**
 * Projection for NEW listings only. bookingEnabled must come from trusted server
 * state, never a request. This is not authorization or a reservation snapshot;
 * existing bookings and holds must later use their own immutable snapshots.
 */
export function publicMenu(menu: PartnerMenu, categories: readonly PartnerCategory[], merchantId: string, bookingEnabled: boolean) {
  if (!bookingEnabled || menu.merchantId !== merchantId || menuReadiness(menu, categories).length ||
      menu.priceKrw === null || menu.depositKrw === null || menu.durationMinutes === null) return null;
  return {
    id: menu.id, merchantId: menu.merchantId, categoryId: menu.categoryId,
    name: menu.nameEn.trim(), description: menu.descriptionEn.trim(), currency: 'KRW' as const,
    priceKrw: menu.priceKrw, depositKrw: menu.depositKrw, balanceKrw: menu.priceKrw - menu.depositKrw,
    durationMinutes: menu.durationMinutes, cleanupMinutes: menu.cleanupMinutes,
  };
}
