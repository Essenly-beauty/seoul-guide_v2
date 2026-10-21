// 긴 값 스트레스 점검 (2026-10-21, Codex 8차 [P2]): 띄어쓰기 없는 긴 고객 이름·긴 주소(URL) 요청사항이 들어간 전화 예약을 만들고
// 예약 목록·상세·캘린더·고객·정산·홈을 휴대폰(360)·PC(1440)에서 측정한 뒤, 그 예약을 업체 취소(사유: 기타)로 정리한다. 로컬 QA 전용.
// 실행: NODE_PATH=$PWD/node_modules [QA_IMPL_URL=http://127.0.0.1:3115] node docs/designs/partner-admin-redesign-20261019/qa/impl-long-values.cjs
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const lib = require('./layout-audit-lib.cjs'); const { sleep, settle } = lib;
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(ORIGIN)) throw new Error('local QA only');
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'long'); fs.mkdirSync(OUT, { recursive: true });
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const NAME = 'LONGNAME' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.slice(0, 32); // 40자, 띄어쓰기 없음
const NOTE = 'https://example.com/very/long/path/to/a/reference/page?with=query&and=more&params=1234567890abcdef 그리고 창가 자리 부탁드립니다';
const DATE = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(`${n} — ${info}`)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${info ? ' — ' + String(info).slice(0, 220) : ''}`); };
const measure = async (p, label) => {
  const L = await p.evaluate(lib.auditInPage, { mobile: p.viewportSize().width <= 820, scope: null });
  const bad = [];
  if (L.pageOverflow) bad.push(`page ${L.pageOverflow.scrollWidth}/${L.pageOverflow.clientWidth}`);
  for (const x of L.clipped) if (x.kind === 'clipX' && /LONGNAME|example\.com/.test(x.text + (x.cut || []).join(' '))) bad.push(`clip «${x.text.slice(0, 40)}»`);
  for (const x of L.spills) if (!x.clipped && /LONGNAME|example\.com/.test(x.text)) bad.push(`spill «${x.text.slice(0, 40)}» +${x.over}px`);
  for (const x of L.offscreen) bad.push(`offscreen «${x.text.slice(0, 40)}»`);
  for (const x of L.overlaps) if (/LONGNAME|example/.test(x.a + x.b)) bad.push(`overlap «${x.a}»↔«${x.b}»`);
  await p.screenshot({ path: path.join(OUT, `${label}.jpg`), type: 'jpeg', quality: 70 });
  check(`layout.${label}`, bad.length === 0, bad.join(' | '));
};
(async () => {
  const browser = await chromium.launch();
  const d = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })).newPage(); d.setDefaultTimeout(60000); d.setDefaultNavigationTimeout(180000);
  const go = async (p, r) => { await p.goto(ORIGIN + r, { waitUntil: 'domcontentloaded' }); await settle(p, 60000); await sleep(800); };
  const openRow = async p => { const all = p.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: /^전체$/ }).first(); if (await all.count()) { await all.click(); await sleep(1500); } const row = p.locator('main button.brow').filter({ hasText: NAME }).filter({ hasNotText: '취소' }).first(); if (!(await row.count())) return false; await row.scrollIntoViewIfNeeded(); await row.click(); await sleep(1500); return true; };
  try {
    await lib.login(d, ORIGIN, access.partner, '/partner/bookings'); await settle(d, 60000);
    await d.getByRole('button', { name: /예약 추가/ }).first().click(); await sleep(1200);
    const m = d.locator('.live-modal');
    await m.locator('input[name="source"][value="phone"]').check(); await m.getByLabel('고객 이름').fill(NAME); await m.getByLabel('연락처').fill('+82 10-1234-5678');
    await m.getByLabel('메뉴').selectOption({ index: 1 }); await sleep(800); const st = m.getByLabel('담당자'); if ((await st.locator('option').count()) > 1) await st.selectOption({ index: 1 }); await sleep(800);
    await m.getByLabel('날짜').fill(DATE); await m.getByLabel('날짜').dispatchEvent('change');
    const ts = m.getByLabel(/시작 시간/); for (let i = 0; i < 40; i++) { const o = await ts.locator('option').allInnerTexts(); if (o.length > 1 && !/조회 중/.test(o.join(''))) break; await sleep(500); }
    await ts.selectOption({ index: Math.min(4, (await ts.locator('option').count()) - 1) }); await m.locator('textarea').first().fill(NOTE);
    await Promise.all([d.waitForResponse(r => /\/api\/partner\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 60000 }).catch(() => null), m.getByRole('button', { name: '예약 추가', exact: true }).click()]); await sleep(2500);
    check('created', (await d.locator('.live-modal').count()) === 0 && (await d.locator('main').innerText()).includes(NAME), DATE);
    for (const [vw, vh, tag] of [[1440, 900, 'pc'], [360, 780, 'm']]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: vw < 800, hasTouch: vw < 800, locale: 'ko-KR', storageState: await d.context().storageState() }); await lib.hideDevBadge(ctx);
      const p = await ctx.newPage(); p.setDefaultTimeout(60000); p.setDefaultNavigationTimeout(180000);
      await go(p, '/partner/bookings'); await openRow(p) ? await measure(p, `${tag}-booking-detail`) : check(`${tag}.rowFound`, false);
      await go(p, '/partner/bookings'); const all = p.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: /^전체$/ }).first(); if (await all.count()) { await all.click(); await sleep(1500); } const row = p.locator('main button.brow').filter({ hasText: NAME }).first(); if (await row.count()) await row.scrollIntoViewIfNeeded(); await measure(p, `${tag}-bookings`);
      await go(p, '/partner/calendar'); const di = p.locator('main input[type="date"]').first(); if (await di.count()) { await di.fill(DATE); await di.dispatchEvent('change'); await sleep(1500); } const ev = p.locator('[data-calendar-booking]').filter({ hasText: NAME.slice(0, 8) }).first(); if (await ev.count()) await ev.evaluate(e => e.scrollIntoView({ block: 'center' })); await measure(p, `${tag}-calendar`);
      await go(p, '/partner/customers'); await measure(p, `${tag}-customers`);
      await go(p, '/partner/settlement'); await measure(p, `${tag}-settlement`);
      await go(p, '/partner'); await measure(p, `${tag}-home`);
      await ctx.close();
    }
  } catch (e) { check('crash', false, e.message.split('\n').slice(0, 4).join(' | ')); }
  // 정리: 만든 예약을 업체 취소
  try {
    await d.goto(ORIGIN + '/partner/bookings', { waitUntil: 'domcontentloaded' }); await settle(d, 60000);
    if (await openRow(d)) { await d.getByRole('button', { name: '예약 취소', exact: true }).first().click(); await sleep(1000); const m = d.locator('.live-modal'); await m.locator('select').first().selectOption({ label: '기타' }).catch(() => {}); await Promise.all([d.waitForResponse(r => /\/api\/partner\/operations\/bookings\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 60000 }).catch(() => null), m.locator('button[type="submit"], button.primary').last().click()]); await sleep(1500); }
    check('cleanup.cancelled', !(await d.locator('main button.brow').filter({ hasText: NAME }).filter({ hasNotText: '취소' }).count()));
  } catch (e) { check('cleanup', false, e.message.split('\n')[0]); }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : '') + `\nscreenshots: ${OUT}`);
  process.exit(fail ? 1 : 0);
})();
