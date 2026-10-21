import { expect, test, type Page } from '@playwright/test';

const email = process.env.E2E_PARTNER_EMAIL;
const password = process.env.E2E_PARTNER_PASSWORD;
test.skip(!email || !password, 'needs credentials for an existing QA partner account; this test never saves');

async function traverseAndDismiss(page: Page, direction: 'back' | 'forward') {
  const dialogSeen = new Promise<void>((resolve, reject) => {
    page.once('dialog', async (dialog) => {
      try {
        expect(dialog.message()).toContain('저장하지 않은');
        await dialog.dismiss();
        resolve();
      } catch (error) { reject(error); }
    });
  });
  await page.evaluate((way) => { if (way === 'back') history.back(); else history.forward(); }, direction);
  await dialogSeen;
  await expect(page).toHaveURL(/\/partner\/services$/);
}

async function openServices(page: Page) {
  await page.goto('/login?switch=1');
  await page.locator('.auth-field').first().fill(email!);
  await page.locator('.auth-field').nth(1).fill(password!);
  await page.locator('.auth-cta').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));

  await page.goto('/partner');
  await page.getByRole('navigation', { name: '가맹점 관리' }).getByRole('link', { name: '메뉴·패키지' }).click();
  await page.locator('details').filter({ hasText: '카테고리 관리' }).locator('summary').click();
  await expect(page.getByRole('button', { name: '카테고리 추가' })).toBeEnabled();
}

test('a rejected Back keeps the draft and the next accepted Back traverses one entry', async ({ page }) => {
  await openServices(page);
  await page.getByRole('button', { name: '카테고리 추가' }).click();
  const name = page.getByLabel('카테고리명 (한국어)');
  await name.fill('저장하지 않은 뒤로 가기 초안');
  await traverseAndDismiss(page, 'back');
  await expect(name).toHaveValue('저장하지 않은 뒤로 가기 초안');
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await page.goBack();
  await expect(page).toHaveURL(/\/partner$/);
});

test('a rejected Forward keeps its destination in the history stack', async ({ page }) => {
  await openServices(page);
  await page.getByRole('link', { name: '운영자에게 문의' }).click();
  await expect(page).toHaveURL(/\/support$/);
  await page.goBack();
  const categories = page.locator('details').filter({ hasText: '카테고리 관리' });
  if ((await categories.getAttribute('open')) === null) await categories.locator('summary').click();
  await expect(page.getByRole('button', { name: '카테고리 추가' })).toBeEnabled();
  await page.getByRole('button', { name: '카테고리 추가' }).click();
  const forwardName = page.getByLabel('카테고리명 (한국어)');
  await forwardName.fill('저장하지 않은 앞으로 가기 초안');
  await traverseAndDismiss(page, 'forward');
  await expect(forwardName).toHaveValue('저장하지 않은 앞으로 가기 초안');
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await page.getByRole('button', { name: '편집 닫기' }).click();
  await page.goForward();
  await expect(page).toHaveURL(/\/support$/);
});
