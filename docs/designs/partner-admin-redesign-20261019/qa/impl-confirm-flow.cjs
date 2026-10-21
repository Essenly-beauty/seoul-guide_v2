// 확정 버튼 실제 동작 점검 (2026-10-21): 고객 예약 요청 → 관리자 '예약 확정' → 고객 화면 Confirmed → 관리자 '메시지' 이동
// → 관리자 '예약 취소'(사유 선택 후 제출) → 고객 화면 Cancelled → 관리자 홈 최근 변경.
// 로컬 QA 매장에 예약 1건을 만들고 마지막에 업체 취소로 정리한다(취소 기록이 남는다). 운영 주소에는 쓰지 않는다.
// 실행: NODE_PATH=$PWD/node_modules [QA_IMPL_URL=http://127.0.0.1:3114] node docs/designs/partner-admin-redesign-20261019/qa/impl-confirm-flow.cjs
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const lib = require('./layout-audit-lib.cjs'); const { sleep, settle } = lib;
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(ORIGIN)) throw new Error('local QA only');
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const PLACE = 'myseouldrop-booking-studio';
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
let pass = 0, fail = 0; const fails = [];
const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(`${n} — ${info}`)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${info ? ' — ' + String(info).slice(0, 220) : ''}`); };
const txt = async (p, sel = 'body') => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');

(async () => {
  const browser = await chromium.launch();
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' }); await lib.hideDevBadge(cctx);
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' }); await lib.hideDevBadge(actx);
  const c = await cctx.newPage(), a = await actx.newPage(); for (const p of [c, a]) { p.setDefaultTimeout(60000); p.setDefaultNavigationTimeout(150000); }
  const errs = []; for (const [p, tag] of [[c, 'customer'], [a, 'partner']]) p.on('pageerror', e => errs.push(`${tag}: ${e.message.slice(0, 160)}`));
  const writes = []; a.on('response', r => { if (/\/api\/partner\//.test(r.url()) && !/^(GET|HEAD)$/.test(r.request().method())) writes.push({ m: r.request().method(), s: r.status(), u: r.url().replace(ORIGIN, '').slice(0, 90) }); });
  try {
    // 1) 고객 예약 요청
    await lib.login(c, ORIGIN, access.customer, `/place/${PLACE}/book`);
    const services = c.locator('[role="group"][aria-label="Choose a service"] button'); await services.first().waitFor({ timeout: 90000 }); await services.first().click(); await sleep(800);
    const next = async label => { const b = c.locator('button').filter({ hasText: label }).last(); await b.click(); await sleep(1500); };
    await next('Choose your staff'); await c.locator('[role="group"][aria-label="Choose your staff"] button').first().click(); await sleep(600);
    await next('Choose a date & time'); await sleep(1500);
    const days = c.locator('[role="group"][aria-label="Choose a date"] button'); let chosen = null, start = null;
    for (const i of [3, 4, 2]) {
      if (i >= await days.count()) continue; await days.nth(i).click(); await sleep(2500);
      const slots = c.locator('button').filter({ hasText: /^\s*\d{1,2}:\d{2}\s*$/ });
      const free = await slots.evaluateAll(els => els.map((e, k) => (!e.disabled ? k : -1)).filter(k => k >= 0));
      if (free.length) { const k = free[Math.min(free.length - 1, Math.floor(free.length * 0.6))]; start = (await slots.nth(k).innerText()).trim(); await slots.nth(k).click(); chosen = await days.nth(i).getAttribute('aria-label'); break; }
    }
    check('customer.slot', !!start, `${chosen} ${start}`);
    const [, mon, day] = (chosen || '').match(/, ([A-Z][a-z]{2}) (\d{1,2}),/) || []; const KR = `${MONTHS[mon]}월 ${Number(day)}일`;
    await next('Review booking'); await sleep(2000);
    const name = c.getByLabel(/Full name/i).first(); if (await name.count() && !(await name.inputValue())) await name.fill('QA Confirm');
    const tel = c.locator('input[type="tel"]').first(); if (await tel.count() && !(await tel.inputValue())) await tel.fill('010-0000-0004');
    const customerName = (await name.count()) ? await name.inputValue() : 'QA Confirm';
    await c.locator('button[type="submit"]').filter({ hasText: /Send booking request|Confirm booking/ }).first().click();
    await c.waitForURL(u => /\/bookings\/./.test(u.pathname), { timeout: 120000 }).catch(() => {});
    const bookingPath = new URL(c.url()).pathname; for (let i = 0; i < 60 && !/Awaiting confirmation|Confirmed/.test(await txt(c)); i++) await sleep(1000);
    check('customer.requested', /\/bookings\/./.test(bookingPath) && /Awaiting confirmation/.test(await txt(c)), bookingPath);
    const bookingId = bookingPath.split('/').pop();

    // 2) 관리자 '예약 확정'
    await lib.login(a, ORIGIN, access.partner, '/partner/bookings'); await settle(a);
    const all = a.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: /^전체$/ }).first(); if (await all.count()) { await all.click(); await sleep(2000); }
    const rowRe = new RegExp(`${KR}[^0-9]{0,12}${start}`); let row = null;
    const rows = a.locator('main button, main tr, main li').filter({ hasText: customerName });
    for (let i = 0; i < await rows.count(); i++) { const x = (await rows.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (rowRe.test(x) && /확인 대기/.test(x)) { row = rows.nth(i); break; } }
    check('partner.rowListed', !!row, `${KR} ${start} ${customerName}`);
    if (row) { await row.click(); await sleep(1500); }
    const confirmBtn = a.getByRole('button', { name: '예약 확정', exact: true }).first();
    const w0 = writes.length; if (await confirmBtn.count()) { await confirmBtn.click(); await sleep(1200); }
    const ask = a.locator('.live-modal'); check('partner.confirm.askDialog', (await ask.count()) === 1, (await ask.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80));
    await a.screenshot({ path: path.join(OUT, 'cf-0-partner-confirm-dialog.png') });
    let confirmMs = null;
    if (await ask.count()) { const t0 = Date.now(); await Promise.all([a.waitForResponse(r => /\/api\/partner\/operations\/bookings\//.test(r.url()) && r.request().method() !== 'GET', { timeout: 60000 }).catch(() => null), ask.getByRole('button', { name: '확정', exact: true }).click()]); confirmMs = Date.now() - t0; await a.getByRole('button', { name: '예약 확정', exact: true }).first().waitFor({ state: 'detached', timeout: 30000 }).catch(() => {}); await sleep(800); }
    console.log('confirm round trip ms', confirmMs);
    const cw = writes.slice(w0); check('partner.confirm.request', cw.length > 0 && cw.every(w => w.s < 300), JSON.stringify(cw));
    const detail = await txt(a, 'main');
    const chip = await a.locator('main aside .status, main [class*="detail"] .status, main .status').filter({ hasText: /예약 확정|확인 대기/ }).first().innerText().catch(() => '');
    check('partner.confirm.shown', (await a.locator('.live-modal').count()) === 0 && !(await a.getByRole('button', { name: '예약 확정', exact: true }).count()), `status chip «${chip}»`);
    await a.screenshot({ path: path.join(OUT, 'cf-1-partner-confirmed.png'), fullPage: true });

    // 3) 고객 화면 Confirmed
    await c.reload({ waitUntil: 'domcontentloaded' }); for (let i = 0; i < 60 && !/Confirmed/.test(await txt(c)); i++) await sleep(1000);
    check('customer.confirmedVisible', /Confirmed/.test(await txt(c)), (await txt(c)).match(/.{0,30}Confirmed.{0,40}/)?.[0]);
    await c.screenshot({ path: path.join(OUT, 'cf-2-customer-confirmed.png'), fullPage: true });

    // 4) 관리자 '메시지' 버튼 → 해당 예약 대화
    const msgBtn = a.locator('main button, main a').filter({ hasText: /^\s*메시지\s*$/ }).first();
    if (await msgBtn.count()) { await Promise.all([a.waitForURL(u => u.pathname.startsWith('/partner/messages'), { timeout: 60000 }).catch(() => {}), msgBtn.click()]); await settle(a); for (let i = 0; i < 30 && !(await txt(a, 'main')).includes(customerName); i++) await sleep(1000); }
    check('partner.messageButton', /\/partner\/messages\?booking=/.test(a.url()) && (await txt(a, 'main')).includes(customerName), a.url().replace(ORIGIN, ''));

    // 5) 관리자 '예약 취소' → 사유 → 제출
    await a.goto(ORIGIN + '/partner/bookings', { waitUntil: 'domcontentloaded' }); await settle(a);
    if (await all.count()) { await a.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: /^전체$/ }).first().click(); await sleep(2000); }
    const rows2 = a.locator('main button, main tr, main li').filter({ hasText: customerName }); let row2 = null;
    for (let i = 0; i < await rows2.count(); i++) { const x = (await rows2.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (rowRe.test(x) && /예약 확정/.test(x)) { row2 = rows2.nth(i); break; } }
    check('partner.confirmedRowListed', !!row2);
    if (row2) { await row2.click(); await sleep(1500); }
    await a.getByRole('button', { name: '예약 취소', exact: true }).first().click(); await sleep(1200);
    const modal = a.locator('.live-modal'); check('partner.cancelDialog.open', (await modal.count()) === 1);
    const reason = modal.locator('select').first(); if (await reason.count()) { const opts = await reason.locator('option').allInnerTexts(); const idx = opts.findIndex(o => /고객 요청|기타/.test(o)); await reason.selectOption({ index: idx > 0 ? idx : 1 }).catch(() => {}); }
    await a.screenshot({ path: path.join(OUT, 'cf-3-partner-cancel-dialog.png') });
    const w1 = writes.length; await modal.locator('button[type="submit"], button.primary').last().click(); await sleep(3500);
    const xw = writes.slice(w1); check('partner.cancel.request', xw.length > 0 && xw.every(w => w.s < 300), JSON.stringify(xw));
    check('partner.cancel.dialogClosed', (await a.locator('.live-modal').count()) === 0);
    check('partner.cancel.shown', /취소/.test(await txt(a, 'main')), '');

    // 6) 고객 Cancelled, 관리자 홈 최근 변경
    await c.reload({ waitUntil: 'domcontentloaded' }); for (let i = 0; i < 60 && !/Cancelled/.test(await txt(c)); i++) await sleep(1000);
    check('customer.cancelledVisible', /Cancelled/.test(await txt(c)));
    await c.screenshot({ path: path.join(OUT, 'cf-4-customer-cancelled.png'), fullPage: true });
    await a.goto(ORIGIN + '/partner', { waitUntil: 'domcontentloaded' }); await settle(a);
    const recent = (await txt(a, 'main')).match(/최근 예약 변경.{0,300}/)?.[0] || '';
    check('partner.home.recent', recent.includes(customerName), recent.slice(0, 200));
    check('errors.none', errs.length === 0, errs.join(' | '));
    fs.writeFileSync(path.join(OUT, 'confirm-flow.json'), JSON.stringify({ bookingId, start, chosen, writes }, null, 1));
  } catch (e) { check('crash', false, e.message.split('\n').slice(0, 5).join(' | ')); }
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
  process.exit(fail ? 1 : 0);
})();
