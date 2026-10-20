// 실제 관리자 흐름 점검: 전화 예약 추가 → 캘린더 표시 → 모바일 터치(쓸기=스크롤, 길게 누른 뒤 끌기=이동 안내) → 상세 → 업체 취소.
// 로컬 Supabase의 테스트 매장에만 기록하며, 만든 예약은 마지막에 '기타' 사유로 취소한다(취소 기록 1건이 남는다).
// 실행: NODE_PATH=$PWD/node_modules QA_FLOW_DATE=2026-10-21 node docs/designs/partner-admin-redesign-20261019/qa/impl-flow.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const os = require('os'); const path = require('path');
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAME = '화면점검 테스트';
const DATE = process.env.QA_FLOW_DATE || (() => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); })();
let pass = 0, fail = 0; const failures = [];
const check = (name, ok, info = '') => { ok ? pass++ : (fail++, failures.push(name + (info ? ' — ' + info : ''))); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
const mainText = async p => (await p.locator('main').innerText().catch(() => '')).replace(/\s+/g, ' ');
const login = async (page) => {
  await page.goto(ORIGIN + '/login?next=/partner', { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#signin-email'); await sleep(2000);
  await page.fill('#signin-email', access.partner.email); await page.fill('#signin-password', access.partner.password);
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await page.waitForSelector('main'); await sleep(1500);
};
const go = async (p, r, ms = 2500) => { await p.goto(ORIGIN + r, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main'); await sleep(ms); };
const cancelTestBookings = async (p) => {
  await go(p, '/partner/bookings'); await p.getByRole('button', { name: '전체', exact: true }).first().click().catch(() => {}); await sleep(1500);
  let cancelled = 0;
  for (let guard = 0; guard < 5; guard++) {
    const rows = p.locator('main').getByText(NAME); let target = -1;
    for (let i = 0; i < await rows.count(); i++) { await rows.nth(i).click(); await sleep(1000); if (await p.getByRole('button', { name: '예약 취소' }).count()) { target = i; break; } await p.getByRole('button', { name: /닫기/ }).first().click().catch(() => {}); await sleep(300); }
    if (target < 0) break;
    await p.getByRole('button', { name: '예약 취소' }).first().click(); await sleep(800);
    const modal = p.locator('.live-modal'); await modal.locator('select').first().selectOption({ label: '기타' }).catch(() => {});
    await modal.locator('button[type="submit"], button.primary').last().click(); await sleep(2500); cancelled++;
    await p.getByRole('button', { name: /닫기/ }).first().click().catch(() => {}); await sleep(500);
  }
  return cancelled;
};
(async () => {
  const browser = await chromium.launch();
  const d = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })).newPage(); const errs = []; d.on('pageerror', e => errs.push(e.message));
  await login(d);
  // 1) 전화 예약 추가
  await go(d, '/partner/bookings'); await d.getByRole('button', { name: /예약 추가/ }).first().click(); await sleep(1000);
  const modal = d.locator('.live-modal');
  await modal.locator('input[name="source"][value="phone"]').check();
  await modal.getByLabel('고객 이름').fill(NAME); await modal.getByLabel('연락처').fill('010-0000-0002');
  await modal.getByLabel('메뉴').selectOption({ index: 1 }); await sleep(800);
  const staffSel = modal.getByLabel('담당자'); if ((await staffSel.locator('option').count()) > 1) await staffSel.selectOption({ index: 1 }); await sleep(800);
  await modal.getByLabel('날짜').fill(DATE); await modal.getByLabel('날짜').dispatchEvent('change');
  const timeSel = modal.getByLabel(/시작 시간/); let times = [];
  for (let i = 0; i < 30; i++) { times = await timeSel.locator('option').allInnerTexts(); if (times.length > 1 || !/조회 중/.test(times.join(''))) break; await sleep(500); }
  check('flow.editor.times', times.length > 1, `${DATE} options=${times.length} first=${times.slice(1, 3).join(',')}`);
  if (times.length > 1) await timeSel.selectOption({ index: Math.min(3, times.length - 1) });
  await d.screenshot({ path: path.join(OUT, 'd-booking-editor.png') });
  await modal.getByRole('button', { name: '예약 추가' }).click(); await sleep(3000);
  const listText = await mainText(d);
  check('flow.editor.saved', (await d.locator('.live-modal').count()) === 0 && listText.includes(NAME), listText.slice(0, 160));
  // 2) 캘린더 표시 + 상세
  await go(d, '/partner/calendar'); await d.locator('input[type="date"]').first().fill(DATE); await sleep(1500);
  const evs = await d.locator('[data-calendar-booking]').evaluateAll(els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  check('flow.calendar.shows', evs.some(t => t.includes(NAME)), evs.join(' | ').slice(0, 160));
  await d.screenshot({ path: path.join(OUT, 'd-calendar-booking.png'), fullPage: true });
  await d.locator('[data-calendar-booking]').filter({ hasText: NAME }).first().click(); await sleep(1000);
  const detail = await mainText(d);
  check('flow.calendar.detail', /예약 취소/.test(detail) && /시간 변경/.test(detail) && /결제 방식/.test(detail), detail.match(/.{0,40}결제 방식.{0,40}/)?.[0]);
  await d.context().close();
  // 3) 모바일 터치
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'ko-KR' });
  const m = await mctx.newPage(); await login(m);
  await go(m, '/partner/calendar'); await m.locator('input[type="date"]').first().fill(DATE); await sleep(1500);
  const ev = m.locator('[data-calendar-booking]').filter({ hasText: NAME }).first();
  check('flow.m.calendar.shows', (await ev.count()) === 1);
  if (await ev.count()) {
    await ev.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(400);
    const cdp = await mctx.newCDPSession(m);
    const pos = () => m.evaluate(() => ({ win: Math.round(scrollY), inner: [...document.querySelectorAll('main *')].filter(e => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map(e => Math.round(e.scrollTop)) }));
    const box = await ev.boundingBox(); const x = box.x + box.width / 2, y = box.y + Math.min(14, box.height / 2);
    const tp = yy => [{ x, y: yy, radiusX: 2, radiusY: 2, force: 1 }];
    const before = await pos();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(y) });
    for (let i = 1; i <= 6; i++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(y - i * 25) }); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(500);
    const after = await pos(); const hint = (await mainText(m)).match(/이동할 시간|로 이동/)?.[0] || '';
    check('flow.m.touch.swipeScrolls', JSON.stringify(after) !== JSON.stringify(before) && !hint, `before=${JSON.stringify(before)} after=${JSON.stringify(after)} hint="${hint}"`);
    await ev.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(300);
    const rest = await pos(); // 길게 누르고 끄는 동안 이 위치가 유지돼야 한다
    const b2 = await ev.boundingBox(); const x2 = b2.x + b2.width / 2, y2 = b2.y + Math.min(14, b2.height / 2);
    const tp2 = yy => [{ x: x2, y: yy, radiusX: 2, radiusY: 2, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp2(y2) }); await sleep(700);
    const held = (await mainText(m)).match(/이동할 시간[^.]{0,30}/)?.[0] || '';
    for (let i = 1; i <= 8; i++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp2(y2 + i * 12) }); }
    await sleep(150);
    const dragging = (await mainText(m)).match(/[^ ]{0,20}로 이동[^.]{0,20}/)?.[0] || ''; const during = await pos();
    await m.screenshot({ path: path.join(OUT, 'm-calendar-touch.png') });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(800);
    const confirmBtn = m.locator('main button:visible').filter({ hasText: /변경 확정/ });
    check('flow.m.touch.longPressDrags', !!held && !!dragging && JSON.stringify(during) === JSON.stringify(rest) && (await confirmBtn.count()) === 1, `held="${held}" drag="${dragging}" scroll ${JSON.stringify(rest)}→${JSON.stringify(during)} confirm=${await confirmBtn.count()}`);
    await m.locator('main button:visible').filter({ hasText: /^닫기$/ }).first().click().catch(() => {}); // 이동은 저장하지 않는다
  }
  await mctx.close();
  // 4) 업체 취소로 정리
  const c = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })).newPage(); await login(c);
  const n = await cancelTestBookings(c);
  check('flow.cancel', n >= 1, `cancelled=${n}`);
  await go(c, '/partner/bookings'); await c.getByRole('button', { name: '전체', exact: true }).first().click().catch(() => {}); await sleep(1500);
  const rowsLeft = await c.locator('main').getByText(NAME).count(); const txt = await mainText(c);
  check('flow.cancel.noActive', rowsLeft >= 1 && !/예약 확정 [1-9]/.test(txt.match(/확인 대기 \d+ 예약 확정 \d+/)?.[0] || ''), txt.match(/전체 \d+ 확인 대기 \d+ 예약 확정 \d+ 취소 \d+/)?.[0]);
  await c.screenshot({ path: path.join(OUT, 'd-bookings-after-cancel.png'), fullPage: true });
  check('flow.noPageErrors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? `\nFAILED:\n- ${failures.join('\n- ')}` : '') + `\nscreenshots: ${OUT}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
