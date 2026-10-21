// 웹앱 ↔ 관리자 왕복 실측 (2026-10-21). 날짜·시간은 그때 비어 있는 칸에서 고른다(전날 고정값 16:00 이 이미 예약돼 멈췄던 문제 수정).
// (A) 비회원: 검색 → 결과 → /map?place → 시트 전체 상세 → 외부 지도 링크 목적지 → 뒤로가기
// (B) 회원: 예약 요청 → 고객 메시지 → 관리자 스레드 확인·답장 → 고객 화면 답장 표시 → 관리자 시간 변경 → 고객 목록 반영 → 고객 취소 → 관리자 상태·최근 변경
// 로컬 테스트 계정은 $TMPDIR/myseouldrop-booking-local-access.json 에서 읽고 값은 출력하지 않는다. 로컬 테스트 매장에 예약 1건을 만들고 취소한다 — 운영 주소에는 쓰지 않는다.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const ORIGIN = process.env.QA_IMPL_URL || 'http://127.0.0.1:3113';
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const PLACE = process.env.PLACE || 'myseouldrop-booking-studio';
const SEARCH = process.env.SEARCH || 'JUNO';
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const RUN = process.env.QA_RUN_ID || String(process.pid);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = []; const R = {};
const record = (k, v) => { R[k] = v === undefined ? null : v; fs.writeFileSync(path.join(OUT, 'member-roundtrip.json'), JSON.stringify(R, null, 1)); };
const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); record('check:' + n, { ok: !!ok, info: String(info).slice(0, 400) }); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 220) : '')); };
const txt = async (p, sel = 'body') => (await p.locator(sel).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
const login = async (p, kind, next) => {
  await p.goto(ORIGIN + '/login?next=' + encodeURIComponent(next), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#signin-email'); await sleep(2000);
  await p.fill('#signin-email', access[kind].email); await p.fill('#signin-password', access[kind].password);
  await Promise.all([p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }).catch(() => {}), p.click('button[type="submit"]')]);
};
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

(async () => {
  const browser = await chromium.launch();
  const phone = async (opts = {}) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US', ...opts }); const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160))); return { ctx, p, errs }; };

  // ── (A) search → map → detail → external map → back ─────────────
  if (!process.env.SKIP_A) { const { ctx, p, errs } = await phone();
    await p.goto(ORIGIN + '/search', { waitUntil: 'domcontentloaded' }); await sleep(4000);
    await p.locator('input').first().fill(SEARCH); await sleep(2500);
    const rows = p.locator('.listrow button'); const first = await rows.first().innerText().then(t => t.replace(/\s+/g, ' ')).catch(() => '');
    check('A.search.results', (await rows.count()) > 0, `count=${await rows.count()} first="${first.slice(0, 80)}"`);
    const name = first.split(' · ')[0].split('|')[0].trim();
    await p.screenshot({ path: path.join(OUT, 'rt-A1-search.png') });
    await rows.first().click(); await p.waitForURL(u => u.pathname === '/map' && u.searchParams.has('place'), { timeout: 90000 }).catch(() => {}); await p.waitForSelector('.mapsheet', { timeout: 150000 }); await sleep(5000);
    const placeId = new URL(p.url()).searchParams.get('place');
    check('A.map.deepLink', !!placeId, p.url().replace(ORIGIN, ''));
    check('A.map.summaryShowsResult', (await txt(p, '.mapsheet')).includes(name.split(' ')[0]), `name="${name}"`);
    await p.screenshot({ path: path.join(OUT, 'rt-A2-map-selected.png') });
    const handle = p.getByRole('button', { name: /Press to fully expand/ }).first(); if (await handle.count()) { await handle.click(); await sleep(2500); }
    const detail = p.locator('.mapsheet-detail-body .detail-scroll');
    check('A.detail.open', (await detail.count()) === 1, `detail=${await detail.count()}`);
    const intro = await txt(p, '.mapsheet-detail-body .place-detail-intro');
    check('A.detail.title', intro.includes(name.split(' ')[0]), `intro="${intro.slice(0, 100)}"`);
    await p.screenshot({ path: path.join(OUT, 'rt-A3-map-detail.png') });
    const ext = await p.evaluate(() => [...document.querySelectorAll('.mapsheet a, .cta-bar a, a')].filter(a => /google\.|kakao|naver/i.test(a.href)).map(a => ({ label: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 20), href: a.href })).slice(0, 6));
    record('A.externalLinks', ext);
    const google = ext.find(e => /google\./.test(e.href));
    check('A.external.google.destinationIsName', !!google && /destination=/.test(google.href) && !/destination=-?\d+\.\d+,-?\d+\.\d+/.test(google.href), google ? decodeURIComponent(google.href).slice(0, 160) : 'no google link');
    check('A.external.kakaoNaver', ext.some(e => /kakao/.test(e.href)) && ext.some(e => /naver/.test(e.href)), ext.map(e => e.label).join(', '));
    await p.goBack(); await sleep(4000);
    check('A.back.returnsToSearch', new URL(p.url()).pathname === '/search', p.url().replace(ORIGIN, ''));
    check('A.errors.none', errs.length === 0, errs.join(' | '));
    await ctx.close(); }

  // ── (B) member round trip ───────────────────────────────────────
  const { ctx: cctx, p: c, errs: cerrs } = await phone();
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' }); const a = await actx.newPage(); a.setDefaultNavigationTimeout(180000); a.setDefaultTimeout(60000);
  const net = []; a.on('response', async r => { if (/\/api\/partner\//.test(r.url()) && r.request().method() !== 'GET') { let b = ''; try { b = (await r.text()).slice(0, 160); } catch {} net.push({ m: r.request().method(), status: r.status(), url: r.url().replace(ORIGIN, '').slice(0, 100), body: b }); } });
  const mt = async () => txt(a, 'main');
  try {
    await login(c, 'customer', `/place/${PLACE}/book`);
    await c.locator('button').filter({ hasText: /Signature cut/ }).first().waitFor({ timeout: 90000 }); await sleep(800);
    const step = async re => { const l = c.locator('button, a, label').filter({ hasText: re }).first(); await l.waitFor({ timeout: 60000 }); await l.click(); await sleep(1500); };
    await step(/Signature cut/); await step(/Choose your staff/); await step(/Senior stylist/); await step(/Choose a date & time/); await sleep(2500);
    const dateButtons = c.getByRole('button', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}, \d{4}$/ });
    const dateLabels = await dateButtons.allInnerTexts().catch(() => []);
    const labels = (await dateButtons.evaluateAll(els => els.map(e => (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim()))).filter(Boolean);
    record('B.dates', labels.length ? labels : dateLabels);
    // two days out avoids same-day cutoffs; fall back to the last date offered
    let chosen = null, slots = [];
    for (const i of [2, 3, 4, 1]) {
      if (i >= labels.length) continue;
      await dateButtons.nth(i).click(); await sleep(3000);
      slots = await c.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).evaluateAll(els => els.filter(e => !e.disabled && e.getAttribute('aria-disabled') !== 'true').map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()));
      if (slots.length >= 2) { chosen = labels[i]; break; }
    }
    check('B.slots.available', !!chosen && slots.length >= 2, `date=${chosen} slots=${slots.join(',')}`);
    const START = slots[Math.max(0, Math.floor(slots.length / 2) - 1)];
    const [, mon, day] = chosen.match(/, ([A-Z][a-z]{2}) (\d{1,2}),/) || [];
    const KR_DATE = `${MONTHS[mon]}월 ${Number(day)}일`;
    const ISO_DATE = `${chosen.match(/\d{4}$/)[0]}-${String(MONTHS[mon]).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
    record('B.target', { chosen, START, KR_DATE, ISO_DATE });
    await c.getByRole('button', { name: new RegExp('^' + START + '$') }).first().click(); await sleep(1500);
    await step(/Review booking/); await sleep(2500);
    const fullName = c.getByLabel(/Full name/i).first(); if (await fullName.count() && !(await fullName.inputValue())) await fullName.fill('QA Guest');
    const tel = c.locator('input[type="tel"]').first(); if (await tel.count() && !(await tel.inputValue())) await tel.fill('010-0000-0003');
    const customerName = (await fullName.count()) ? await fullName.inputValue() : 'QA Guest'; record('B.customerName', customerName);
    await c.locator('button[type="submit"]').filter({ hasText: /Send booking request|Confirm booking/ }).first().click();
    await c.waitForURL(u => /\/bookings\//.test(u.pathname), { timeout: 90000 }).catch(() => {}); await sleep(5000);
    const bookingUrl = c.url().replace(ORIGIN, ''); const created = await txt(c);
    check('B.created', /\/bookings\//.test(bookingUrl) && /Awaiting confirmation|Confirmed/.test(created), `url=${bookingUrl} status=${created.match(/Awaiting confirmation|Confirmed/)?.[0]}`);
    await c.screenshot({ path: path.join(OUT, 'rt-B1-created.png'), fullPage: true });

    // customer → partner message
    const MSG = `QA ${RUN}: 주차 가능한가요?`; const REPLY = `QA ${RUN}: 지하 주차 2시간 무료입니다.`;
    const ta = c.locator('textarea').first(); await ta.waitFor({ timeout: 60000 }).catch(() => {});
    if (await ta.count()) { await ta.fill(MSG); await c.getByRole('button', { name: /Send message|^Send$/ }).first().click(); await sleep(6000); }
    check('B.customer.messageShown', (await txt(c)).includes(MSG), (await txt(c)).match(/.{0,40}주차 가능한가요.{0,40}/)?.[0] || 'not shown');

    await login(a, 'partner', '/partner/messages'); await a.waitForSelector('main');
    const settle = async (ms = 90000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const m = await mt(); if (m && !/불러오고 있습니다|확인하고 있습니다|조회 중/.test(m)) return Date.now() - t0; await sleep(1000); } return -1; };
    record('B.partner.messagesLoadMs', await settle()); await sleep(1500);
    // the newest thread carrying this run's message, else the newest for the customer
    const byMsg = a.locator('main button').filter({ hasText: MSG.slice(0, 18) }).first();
    const thread = (await byMsg.count()) ? byMsg : a.locator('main button').filter({ hasText: new RegExp(customerName) }).first();
    if (await thread.count()) { await thread.click(); await sleep(4000); }
    check('B.partner.threadHasMessage', (await mt()).includes(MSG), (await mt()).match(/.{0,60}주차 가능한가요.{0,60}/)?.[0] || (await mt()).slice(0, 160));
    await a.screenshot({ path: path.join(OUT, 'rt-B2-partner-thread.png'), fullPage: true });
    const reply = a.locator('main textarea').first(); let replyStatus = null;
    if (await reply.count()) {
      await reply.click(); await reply.fill(REPLY); await sleep(500);
      const send = a.locator('main button').filter({ hasText: /메시지 보내기/ }).first();
      if (await send.count() && !(await send.isDisabled())) {
        const [resp] = await Promise.all([a.waitForResponse(r => /\/messages$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null), send.click()]);
        replyStatus = resp ? resp.status() : null; await sleep(2500);
      }
    }
    check('B.partner.replySent', replyStatus !== null && replyStatus < 300 && (await mt()).includes(REPLY), `POST status=${replyStatus}`);
    await c.reload({ waitUntil: 'domcontentloaded' }); await sleep(8000);
    check('B.customer.replyVisible', (await txt(c)).includes(REPLY), (await txt(c)).match(/.{0,40}지하 주차.{0,40}/)?.[0] || 'not shown');
    await c.screenshot({ path: path.join(OUT, 'rt-B3-customer-reply.png'), fullPage: true });

    // partner reschedule
    await a.goto(ORIGIN + '/partner/bookings', { waitUntil: 'domcontentloaded' }); await a.waitForSelector('main'); record('B.partner.bookingsLoadMs', await settle()); await sleep(1500);
    const week = a.getByRole('button', { name: '이번 주', exact: true }).first(); if (await week.count()) { await week.click(); await sleep(3000); }
    const startRe = new RegExp(`${KR_DATE}[^0-9]{0,8}${START}`);
    let row = null; const cands = a.locator('main li, main tr, main article, main button, main a').filter({ hasText: new RegExp(customerName) });
    for (let i = 0; i < await cands.count(); i++) { const t = (await cands.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (startRe.test(t)) { row = cands.nth(i); record('B.partner.row', t.slice(0, 160)); break; } }
    check('B.partner.bookingListed', !!row, `looking for ${KR_DATE} ${START} ${customerName}`);
    if (row) { await row.click(); await sleep(2000); }
    const resched = a.getByRole('button', { name: '시간 변경', exact: true }).first();
    let NEW_START = null;
    if (await resched.count()) {
      await resched.click(); await sleep(2500);
      const modal = a.locator('.live-modal'); const scope = (await modal.count()) ? modal : a.locator('main');
      const dateIn = scope.locator('input[type="date"]').first(); if (await dateIn.count()) { await dateIn.fill(ISO_DATE); await dateIn.dispatchEvent('change'); }
      const timeSel = scope.locator('select').last();
      for (let i = 0; i < 40; i++) { const o = await timeSel.locator('option').allInnerTexts(); if (o.length > 1 && !/조회 중/.test(o.join(''))) break; await sleep(500); }
      const opts = await timeSel.locator('option').allInnerTexts(); record('B.partner.rescheduleOptions', opts.slice(0, 12));
      const idx = opts.findIndex(o => /^\d{1,2}:\d{2}/.test(o) && !o.startsWith(START));
      if (idx >= 0) { NEW_START = opts[idx].match(/^\d{1,2}:\d{2}/)[0]; await timeSel.selectOption({ index: idx }); await sleep(800); }
      const submit = scope.locator('button').filter({ hasText: /변경 확정|변경 저장|확정|저장/ }).last();
      if (await submit.count() && NEW_START) { await submit.click(); await sleep(6000); }
      await a.screenshot({ path: path.join(OUT, 'rt-B4-partner-reschedule.png'), fullPage: true });
    }
    const rnet = net.filter(n => /bookings\//.test(n.url)).slice(-1)[0];
    check('B.partner.rescheduled', !!NEW_START && !!rnet && rnet.status < 300, `new=${NEW_START} net=${JSON.stringify(rnet || {}).slice(0, 140)}`);
    record('B.newStart', NEW_START);

    await c.goto(ORIGIN + '/bookings', { waitUntil: 'domcontentloaded' }); await sleep(7000);
    const list = await txt(c);
    check('B.customer.seesNewTime', !!NEW_START && list.includes(NEW_START) && new RegExp(`${mon} ${Number(day)}, \\d{4} · ${NEW_START}`).test(list), (list.match(new RegExp(`.{0,40}${mon} ${Number(day)}, \\d{4} · \\d{1,2}:\\d{2}.{0,20}`)) || [])[0] || list.slice(0, 160));
    await c.screenshot({ path: path.join(OUT, 'rt-B5-customer-list.png'), fullPage: true });

    // customer cancel
    await c.goto(ORIGIN + bookingUrl, { waitUntil: 'domcontentloaded' }); await sleep(7000);
    const cancelBtn = c.locator('button').filter({ hasText: /Cancel booking/ }).first();
    if (await cancelBtn.count()) { await cancelBtn.click(); await sleep(2500); const confirm = c.locator('[role="dialog"] button').filter({ hasText: /Yes|Confirm|Cancel booking/ }).last(); if (await confirm.count()) { await confirm.click(); await sleep(7000); } }
    const afterCancel = await txt(c);
    check('B.customer.cancelled', /Cancelled|cancelled/.test(afterCancel), afterCancel.match(/.{0,40}[Cc]ancelled.{0,60}/)?.[0] || afterCancel.slice(0, 160));
    await c.screenshot({ path: path.join(OUT, 'rt-B6-customer-cancelled.png'), fullPage: true });

    await a.goto(ORIGIN + '/partner/bookings', { waitUntil: 'domcontentloaded' }); await a.waitForSelector('main'); await sleep(8000);
    if (await week.count()) { await a.getByRole('button', { name: '이번 주', exact: true }).first().click().catch(() => {}); await sleep(3000); }
    const partnerList = await mt();
    const cancelledRow = (partnerList.match(new RegExp(`${KR_DATE}[^0-9]{0,12}${NEW_START || START}[^]{0,160}`)) || [])[0] || '';
    check('B.partner.showsCancelled', /취소/.test(cancelledRow), cancelledRow.slice(0, 200) || partnerList.slice(0, 200));
    await a.goto(ORIGIN + '/partner', { waitUntil: 'domcontentloaded' }); await a.waitForSelector('main'); await sleep(7000);
    const recent = (await mt()).match(/최근 예약 변경.{0,260}/)?.[0] || '';
    check('B.partner.homeRecentHasCancel', /취소/.test(recent) && recent.includes(customerName), recent.slice(0, 220));
    check('B.customer.errors.none', cerrs.length === 0, cerrs.join(' | '));
  } catch (e) {
    check('B.crash', false, e.message.split('\n').slice(0, 6).join(' | '));
  }
  await cctx.close(); await actx.close(); await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : '')); console.log('evidence:', path.join(OUT, 'member-roundtrip.json'));
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
