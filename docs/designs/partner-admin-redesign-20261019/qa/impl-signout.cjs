// 로그아웃 확인 (2026-10-21).
// (1) 오프라인 + 유효한 토큰: auth-js가 기기의 세션을 지우고 성공한다(서버 호출 실패는 무시). 모달은 알림 없이
//     기기 사본(즐겨찾기 미러·소유 태그·병합 표시)을 지우고 닫히며, 다시 온라인이 된 뒤에도 로그아웃 상태여야 한다.
// (2) 온라인: 같은 흐름이 routes.welcome('/', 지도로 리다이렉트)으로 이동하고 기기 사본을 지운다.
// 실패 경로(만료된 토큰 + 오프라인 → signOut 이 { error } 를 돌려주고 세션이 남음)는 브라우저에서 만들기 어려워
// 단위 테스트 lib/signout-modal-result.test.ts 가 고정한다(알림 표시·사본 유지·이동 없음).
// 로컬 테스트 고객 계정을 $TMPDIR/myseouldrop-booking-local-access.json 에서 읽고 값은 출력하지 않는다.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const ORIGIN = process.env.QA_IMPL_URL || 'http://127.0.0.1:3113';
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = []; const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 200) : '')); };
const mirrorKeys = p => p.evaluate(() => ['essenly.favorites', 'essenly.favorites.owner', 'essenly.favorites.mergedFor'].filter(k => localStorage.getItem(k) !== null));
const signIn = async (p) => {
  await p.goto(ORIGIN + '/login?next=' + encodeURIComponent('/settings/account'), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#signin-email'); await sleep(2000);
  await p.fill('#signin-email', access.customer.email); await p.fill('#signin-password', access.customer.password);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }).catch(() => {}), p.click('button[type="submit"]')]);
  await p.goto(ORIGIN + '/settings/account', { waitUntil: 'domcontentloaded' }); await sleep(5000);
};
const openModal = async (p) => { await p.locator('button.signout-menu-row').first().click(); await p.waitForSelector('[role="dialog"]'); await sleep(500); };
const confirm = (p) => p.locator('[role="dialog"] button').filter({ hasText: /^Sign Out$/ }).first();
(async () => {
  const b = await chromium.launch();
  // (1) offline with a valid token
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000);
    await signIn(p);
    check('offline.before.mirrorTagged', (await mirrorKeys(p)).includes('essenly.favorites.owner'), JSON.stringify(await mirrorKeys(p)));
    await openModal(p); await ctx.setOffline(true);
    await confirm(p).click(); await sleep(4000);
    check('offline.noFailureAlert', (await p.locator('[role="alert"]').filter({ hasText: /Couldn.t sign out/ }).count()) === 0);
    check('offline.mirrorCleared', (await mirrorKeys(p)).length === 0, JSON.stringify(await mirrorKeys(p)));
    check('offline.dialogClosed', (await p.locator('[role="dialog"]').count()) === 0, `dialogs=${await p.locator('[role="dialog"]').count()}`);
    await p.screenshot({ path: path.join(OUT, 'signout-offline.png') });
    await ctx.setOffline(false); await sleep(1000);
    await p.goto(ORIGIN + '/settings/account', { waitUntil: 'domcontentloaded' }); await sleep(4000);
    check('offline.staysSignedOutWhenBackOnline', (await p.locator('button.signout-menu-row').count()) === 0, `signout rows=${await p.locator('button.signout-menu-row').count()}`);
    await ctx.close(); }
  // (2) online
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000);
    await signIn(p);
    check('online.before.mirrorTagged', (await mirrorKeys(p)).includes('essenly.favorites.owner'), JSON.stringify(await mirrorKeys(p)));
    await openModal(p);
    // routes.welcome is "/", which redirects visitors straight to the map (app/page.tsx)
    await Promise.all([p.waitForURL(u => u.pathname === '/' || u.pathname === '/map', { timeout: 90000 }).catch(() => {}), confirm(p).click()]); await sleep(3000);
    check('online.leftForWelcome', ['/', '/map'].includes(new URL(p.url()).pathname), p.url().replace(ORIGIN, ''));
    check('online.mirrorCleared', (await mirrorKeys(p)).length === 0, JSON.stringify(await mirrorKeys(p)));
    await p.goto(ORIGIN + '/settings/account', { waitUntil: 'domcontentloaded' }); await sleep(4000);
    check('online.signedOut', (await p.locator('button.signout-menu-row').count()) === 0, `signout rows=${await p.locator('button.signout-menu-row').count()}`);
    await ctx.close(); }
  await b.close(); console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
