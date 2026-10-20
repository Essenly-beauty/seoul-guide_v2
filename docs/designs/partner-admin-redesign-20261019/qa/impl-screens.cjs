// 실제 관리자(기본 http://127.0.0.1:3113, /partner/*) 13개 화면을 PC(1440)·모바일(390)에서 로그인한 상태로 찍고
// HTTP 상태·콘솔 오류·가로 넘침·하단 메뉴·더보기 메뉴를 기록한다. 시안(3111)이 아니라 Next.js 앱을 대상으로 한다.
// 로그인 계정은 scripts/provision-local-booking-preview.cjs 가 만든 $TMPDIR/myseouldrop-booking-local-access.json 에서 읽고 출력하지 않는다.
// 실행: NODE_PATH=$PWD/node_modules node docs/designs/partner-admin-redesign-20261019/qa/impl-screens.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTES = [
  ['home', '/partner'], ['calendar', '/partner/calendar'], ['bookings', '/partner/bookings'], ['customers', '/partner/customers'],
  ['messages', '/partner/messages'], ['statistics', '/partner/statistics'], ['services', '/partner/services'], ['staff', '/partner/staff'],
  ['availability', '/partner/availability'], ['roster', '/partner/roster'], ['rules', '/partner/rules'], ['settlement', '/partner/settlement'], ['settings', '/partner/settings'],
];
let pass = 0, fail = 0; const failures = [];
const check = (name, ok, info = '') => { ok ? pass++ : (fail++, failures.push(name + (info ? ' — ' + info : ''))); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const errBucket = (page, store) => { page.on('pageerror', e => store.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') store.push('console: ' + m.text().slice(0, 300)); }); };
// 폴링(30초)과 포커스 복귀 조회 때문에 networkidle은 쓰지 않는다. 로딩 문구가 사라질 때까지 최대 8초 기다린다.
const settle = async (page) => { await page.waitForSelector('main', { timeout: 15000 }).catch(() => {}); for (let i = 0; i < 16; i++) { await sleep(500); const t = await page.locator('main').innerText().catch(() => ''); if (t.length > 120 && !/불러오고 있습니다|확인하고 있습니다|조회하고 있어요/.test(t)) break; } };
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const h1 = page => page.locator('main h1').first().innerText().then(t => t.replace(/\s+/g, ' ').trim()).catch(() => '');
const login = async (page, kind) => {
  await page.goto(ORIGIN + '/login?next=/partner', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#signin-email'); await sleep(2000); // 하이드레이션 전에 제출하면 네이티브 GET 제출이 일어난다(결함으로 기록됨)
  await page.fill('#signin-email', access[kind].email); await page.fill('#signin-password', access[kind].password);
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await settle(page);
  const u = new URL(page.url()); return u.pathname + (u.search.includes('password') ? '?<credentials-in-query>' : u.search);
};
(async () => {
  const browser = await chromium.launch();
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const dp = await dctx.newPage(); const derrs = []; errBucket(dp, derrs);
  const landed = await login(dp, 'partner');
  check('d.login', landed.startsWith('/partner') && !landed.includes('credentials'), landed);
  const nav = await dp.locator('nav[aria-label="가맹점 관리"] a').allInnerTexts();
  check('d.sidebar.13', nav.length === 13, nav.join('/'));
  for (const [key, route] of ROUTES) {
    const before = derrs.length;
    const resp = await dp.goto(ORIGIN + route, { waitUntil: 'domcontentloaded' }); await settle(dp);
    const o = await overflow(dp); const title = await h1(dp);
    const active = await dp.locator('nav[aria-label="가맹점 관리"] a[aria-current="page"]').first().innerText().catch(() => '');
    await dp.screenshot({ path: path.join(OUT, `d-${key}.png`), fullPage: true });
    check(`d.${key}`, resp?.status() === 200 && o.sw <= o.cw && derrs.length === before && title && !/로그인해 주세요/.test(title), `${resp?.status()} h1="${title}" active="${active}" overflow=${o.sw}/${o.cw} errors=${derrs.slice(before).join(' | ')}`);
  }
  await dp.goto(ORIGIN + '/partner/calendar', { waitUntil: 'domcontentloaded' }); await settle(dp);
  for (const v of ['일', '주', '월']) { const b = dp.getByRole('button', { name: v, exact: true }).first(); if (await b.count()) { await b.click(); await sleep(1000); } const cols = await dp.locator('[data-calendar-column]').count(); check(`d.calendar.view.${v}`, (await b.count()) > 0 && (v === '월' || cols > 0), `columns=${cols}`); }
  const state = await dctx.storageState(); await dctx.close();
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ko-KR', storageState: state });
  const mp = await mctx.newPage(); const merrs = []; errBucket(mp, merrs);
  for (const [key, route] of ROUTES) {
    const before = merrs.length;
    const resp = await mp.goto(ORIGIN + route, { waitUntil: 'domcontentloaded' }); await settle(mp);
    const o = await overflow(mp); const title = await h1(mp);
    const bottomNav = await mp.locator('nav.mobile-nav').isVisible().catch(() => false);
    await mp.screenshot({ path: path.join(OUT, `m-${key}.png`), fullPage: true });
    check(`m.${key}`, resp?.status() === 200 && o.sw <= o.cw && merrs.length === before && bottomNav && title && !/로그인해 주세요/.test(title), `${resp?.status()} h1="${title}" bottomNav=${bottomNav} overflow=${o.sw}/${o.cw} errors=${merrs.slice(before).join(' | ')}`);
  }
  await mp.goto(ORIGIN + '/partner', { waitUntil: 'domcontentloaded' }); await settle(mp);
  await mp.locator('nav.mobile-nav button', { hasText: '더보기' }).click(); await sleep(400);
  const links = await mp.locator('#more-menu a').allInnerTexts();
  check('m.moreMenu', (await mp.locator('#more-menu[open]').count()) === 1 && links.length === 9, links.join('/'));
  await mp.screenshot({ path: path.join(OUT, 'm-more-menu.png') });
  await mctx.close(); await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? `\nFAILED:\n- ${failures.join('\n- ')}` : '') + `\nscreenshots: ${OUT}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
