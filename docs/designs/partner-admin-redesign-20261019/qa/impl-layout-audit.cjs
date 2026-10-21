// 관리자(/partner/*)와 고객 예약 흐름의 문장 줄바꿈·잘림·겹침·가려진 버튼을 화면 크기·언어별로 측정한다 (2026-10-21).
// 읽기 전용: 저장·확정·요청 보내기·메시지 보내기·예약 취소 확정 버튼은 누르지 않는다(대화를 열면 읽음 처리되는 것만 로컬 DB에 남는다).
// 실행: NODE_PATH=$PWD/node_modules AUDIT_SIDE=admin AUDIT_VIEWPORT=1440x900 [AUDIT_LOCALE=en] [AUDIT_STATES=id,id] [AUDIT_OUT=dir] node docs/designs/partner-admin-redesign-20261019/qa/impl-layout-audit.cjs
// 결과: <AUDIT_OUT>/<side>-<locale>-<WxH>/<state>.json · .jpg (+ PC는 -full.jpg)
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const lib = require('./layout-audit-lib.cjs');
const ROOT = path.resolve(__dirname, '../../../..');
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
const SIDE = process.env.AUDIT_SIDE || 'admin'; const LOCALE = process.env.AUDIT_LOCALE || (SIDE === 'admin' ? 'ko' : 'en');
const [W, H] = (process.env.AUDIT_VIEWPORT || '1440x900').split('x').map(Number); const TOUCH = W <= 1024;
const ONLY = process.env.AUDIT_STATES ? new Set(process.env.AUDIT_STATES.split(',')) : null;
const OUT = path.join(process.env.AUDIT_OUT || path.join(os.tmpdir(), 'layout-audit'), `${SIDE}-${LOCALE}-${W}x${H}`); fs.mkdirSync(OUT, { recursive: true });
const PLACE = process.env.PLACE || 'myseouldrop-booking-studio';
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const t = lib.loadTranslations(ROOT)(LOCALE === 'ko' ? 'en' : LOCALE);
const { sleep, settle } = lib;
const MODAL = '.live-modal, dialog[open], [role="dialog"][aria-modal="true"]';

// ── 관리자 화면 상태 ─────────────────────────────────────────────
const clickText = async (p, re, scope = 'main') => { const l = p.locator(`${scope} button, ${scope} a, ${scope} summary, ${scope} [role="tab"]`).filter({ hasText: re }).first(); if (!(await l.count())) return false; await l.click(); await sleep(900); return true; };
const pendingRow = async p => {
  const cands = p.locator('main li, main tr, main article, main [role="listitem"], main button, main a').filter({ hasText: /확인 대기/ });
  for (let i = 0; i < await cands.count(); i++) { const x = (await cands.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (/\d{1,2}:\d{2}/.test(x) && x.length < 260 && !/^확인 대기 \d+$/.test(x)) { await cands.nth(i).click(); await sleep(1500); return true; } }
  return false;
};
const statusRow = async (p, re) => {
  const cands = p.locator('main tr, main li, main [role="listitem"]').filter({ hasText: re });
  for (let i = 0; i < await cands.count(); i++) { const x = (await cands.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (/\d{1,2}:\d{2}/.test(x) && x.length < 260) { await cands.nth(i).click(); await sleep(1500); return true; } }
  return false;
};
const period = async (p, name) => { const b = p.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: new RegExp(`^${name}$`) }).first(); if (await b.count()) { await b.click(); await sleep(1500); return true; } return false; };
const calView = async (p, v) => { const b = p.getByRole('button', { name: v, exact: true }).first(); if (await b.count()) { await b.click(); await sleep(1200); } const block = p.locator('[data-calendar-booking]').first(); if (v !== '월' && await block.count()) { await block.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(500); } return true; };
const ADMIN = [
  { id: 'home', url: '/partner' },
  { id: 'calendar-day', url: '/partner/calendar', setup: p => calView(p, '일') },
  { id: 'calendar-week', url: '/partner/calendar', setup: p => calView(p, '주') },
  { id: 'calendar-month', url: '/partner/calendar', setup: p => calView(p, '월') },
  { id: 'bookings-today', url: '/partner/bookings', setup: p => period(p, '오늘') },
  { id: 'bookings-all', url: '/partner/bookings', setup: p => period(p, '전체') },
  { id: 'bookings-daterange', url: '/partner/bookings', setup: async p => { const s = p.locator('main details.live-range summary').first(); if (await s.count()) { await s.click(); await sleep(800); return true; } return false; } },
  { id: 'booking-detail-pending', url: '/partner/bookings', setup: async p => { await period(p, '전체'); return pendingRow(p); } },
  { id: 'booking-detail-cancelled', url: '/partner/bookings', setup: async p => { await period(p, '전체'); return statusRow(p, /취소/); } },
  { id: 'booking-history', url: '/partner/bookings', setup: async p => { await period(p, '전체'); if (!await pendingRow(p)) return false; const s = p.locator('summary').filter({ hasText: /예약 기록/ }).first(); if (await s.count()) { await s.click(); await sleep(900); } return true; } },
  { id: 'booking-add', url: '/partner/bookings', modal: true, setup: async p => { await p.getByRole('button', { name: /예약 추가/ }).first().click(); await sleep(1200); return (await p.locator(MODAL).count()) > 0; } },
  { id: 'booking-add-filled', url: '/partner/bookings', modal: true, setup: async p => {
    await p.getByRole('button', { name: /예약 추가/ }).first().click(); await sleep(1200); const m = p.locator('.live-modal'); if (!(await m.count())) return false;
    await m.locator('input[name="source"][value="phone"]').check().catch(() => {}); await m.getByLabel('고객 이름').fill('김서울 (Kim Seoul) 외국인 관광객').catch(() => {}); await m.getByLabel('연락처').fill('+82 10-0000-0000').catch(() => {});
    await m.getByLabel('메뉴').selectOption({ index: 1 }).catch(() => {}); await sleep(700); const st = m.getByLabel('담당자'); if ((await st.locator('option').count().catch(() => 0)) > 1) await st.selectOption({ index: 1 }).catch(() => {}); await sleep(700);
    const d = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10); await m.getByLabel('날짜').fill(d).catch(() => {}); await m.getByLabel('날짜').dispatchEvent('change').catch(() => {});
    const ts = m.getByLabel(/시작 시간/); for (let i = 0; i < 30; i++) { const o = await ts.locator('option').allInnerTexts().catch(() => []); if (o.length > 1 || !/조회 중/.test(o.join(''))) break; await sleep(500); } if ((await ts.locator('option').count().catch(() => 0)) > 2) await ts.selectOption({ index: 2 }).catch(() => {});
    await m.locator('textarea').first().fill('창가 자리 요청. 영어 상담 가능하면 좋겠습니다. 알레르기: 없음').catch(() => {}); await sleep(500); return true; } },
  { id: 'booking-reschedule', url: '/partner/bookings', modal: true, setup: async p => { await period(p, '전체'); if (!await pendingRow(p)) return false; const b = p.getByRole('button', { name: '시간 변경', exact: true }).first(); if (!(await b.count())) return false; await b.click(); await sleep(2000); return (await p.locator(MODAL).count()) > 0; } },
  { id: 'booking-cancel-dialog', url: '/partner/bookings', modal: true, setup: async p => { await period(p, '전체'); if (!await pendingRow(p)) return false; const b = p.getByRole('button', { name: '예약 취소', exact: true }).first(); if (!(await b.count())) return false; await b.click(); await sleep(1200); return (await p.locator(MODAL).count()) > 0; } },
  { id: 'customers', url: '/partner/customers' },
  { id: 'messages', url: '/partner/messages' },
  { id: 'messages-thread', url: '/partner/messages', setup: async p => { const th = p.locator('.msg-list [role="listitem"] button').first(); if (!(await th.count())) return false; await th.click(); await p.locator('main textarea').first().waitFor({ timeout: 45000 }).catch(() => {}); await sleep(1200); return true; } },
  { id: 'statistics', url: '/partner/statistics' },
  { id: 'services', url: '/partner/services' },
  { id: 'staff', url: '/partner/staff' },
  { id: 'availability', url: '/partner/availability' },
  { id: 'roster', url: '/partner/roster' },
  { id: 'rules', url: '/partner/rules' },
  { id: 'settlement', url: '/partner/settlement' },
  { id: 'settings', url: '/partner/settings' },
  { id: 'more-menu', url: '/partner', mobileOnly: true, setup: async p => { const b = p.locator('nav.mobile-nav button').filter({ hasText: '더보기' }).first(); if (!(await b.count())) return false; await b.click(); await sleep(600); return true; }, scope: '#more-menu' },
];

// ── 고객 예약 흐름(한 번의 진행 안에서 단계마다 측정) ─────────────────────
async function customerJourney(c, audit) {
  await c.goto(ORIGIN + `/place/${PLACE}`, { waitUntil: 'domcontentloaded' }); await settle(c);
  await audit('place-top');
  const entry = c.getByRole('link', { name: t('Book a visit') }).first();
  if (await entry.count()) { await entry.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(800); }
  await audit('place-booking-entry', { keepScroll: true });
  await c.goto(ORIGIN + `/place/${PLACE}/book`, { waitUntil: 'domcontentloaded' });
  const services = c.locator(`[role="group"][aria-label="${t('Choose a service')}"] button`);
  await services.first().waitFor({ timeout: 90000 }); await sleep(1000);
  await audit('book-menu');
  await services.first().click(); await sleep(1000); await audit('book-menu-selected', { keepScroll: true });
  const next = async en => { const b = c.locator('button').filter({ hasText: t(en) }).last(); await b.waitFor({ timeout: 60000 }); await b.click(); await sleep(1500); };
  await next('Choose your staff');
  const staff = c.locator(`[role="group"][aria-label="${t('Choose your staff')}"] button`);
  await staff.first().waitFor({ timeout: 60000 }); await audit('book-staff');
  await staff.first().click(); await sleep(800);
  await next('Choose a date & time'); await sleep(1500);
  await audit('book-datetime');
  const days = c.locator(`[role="group"][aria-label="${t('Choose a date')}"] button`);
  let picked = false;
  for (const i of [2, 3, 1, 4]) {
    if (i >= await days.count()) continue; await days.nth(i).click(); await sleep(2500);
    const slots = c.locator('button').filter({ hasText: /^\s*\d{1,2}[:h]\d{2}\s*$/ });
    const free = await slots.evaluateAll(els => els.map((e, k) => (!e.disabled && e.getAttribute('aria-disabled') !== 'true') ? k : -1).filter(k => k >= 0));
    if (free.length) { await slots.nth(free[Math.floor(free.length / 2)]).click(); await sleep(1000); picked = true; break; }
  }
  await audit('book-time-picked', { keepScroll: true, note: picked ? '' : 'no free slot found' });
  const later = c.getByRole('button', { name: t('Later dates') }).first();
  if (await later.count() && await later.isEnabled()) { await later.click(); await sleep(1500); await audit('book-later-dates', { keepScroll: true }); await c.getByRole('button', { name: t('Earlier dates') }).first().click().catch(() => {}); await sleep(1000); }
  if (picked) {
    await next('Review booking'); await sleep(2000);
    for (let i = 0; i < 60 && /Loading location|Chargement|Cargando|読み込み中|確認中|正在/.test(await c.locator('body').innerText()); i++) await sleep(700);
    const fullName = c.getByLabel(t('Full name')).first(); if (await fullName.count() && !(await fullName.inputValue())) await fullName.fill('QA Guest');
    const tel = c.locator('input[type="tel"]').first(); if (await tel.count() && !(await tel.inputValue())) await tel.fill('010-0000-0003');
    await c.evaluate(() => document.activeElement && document.activeElement.blur());
    await audit('book-review');
  }
  await c.goto(ORIGIN + '/bookings', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 200 && !(await c.getByRole('link', { name: t('View booking') }).count()); i++) await sleep(700);
  await sleep(1200); await audit('bookings');
  const hrefs = await c.evaluate((labels) => {
    const found = {};
    for (const a of document.querySelectorAll('a')) { if (!a.textContent.includes(labels.view)) continue; let el = a.parentElement; while (el && el.querySelectorAll('a').length === 1) { if (!found.pending && el.textContent.includes(labels.pending)) found.pending = a.getAttribute('href'); if (!found.cancelled && el.textContent.includes(labels.cancelled)) found.cancelled = a.getAttribute('href'); el = el.parentElement; } }
    return found;
  }, { view: t('View booking'), pending: t('Awaiting confirmation'), cancelled: t('Cancelled') });
  for (const [kind, href] of Object.entries(hrefs)) {
    await c.goto(ORIGIN + href, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 200 && !(await c.locator('textarea').count()); i++) await sleep(700);
    await sleep(1500); await audit(`booking-detail-${kind}`);
    if (kind === 'pending') {
      const cancel = c.locator('button').filter({ hasText: new RegExp(`^\\s*${t('Cancel booking').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first();
      if (await cancel.count()) { await cancel.scrollIntoViewIfNeeded(); await cancel.click(); await sleep(1200); await audit('booking-cancel-dialog', { scope: '[role="dialog"], [role="alertdialog"], dialog[open]', keepScroll: true }); await c.keyboard.press('Escape'); await sleep(600); }
    }
  }
}
async function guestJourney(c, audit) {
  await c.goto(ORIGIN + `/place/${PLACE}/book`, { waitUntil: 'domcontentloaded' });
  const services = c.locator(`[role="group"][aria-label="${t('Choose a service')}"] button`); await services.first().waitFor({ timeout: 90000 }).catch(() => {}); await sleep(1200);
  await audit('guest-book');
  await c.goto(ORIGIN + '/bookings', { waitUntil: 'domcontentloaded' }); await settle(c); await audit('guest-bookings');
}

(async () => {
  const browser = await chromium.launch(); const summary = [];
  const ctxOpts = { viewport: { width: W, height: H }, deviceScaleFactor: W <= 430 ? 2 : 1, isMobile: TOUCH && W <= 820, hasTouch: TOUCH, locale: LOCALE === 'ko' ? 'ko-KR' : LOCALE };
  const newCtx = async () => { const ctx = await browser.newContext(ctxOpts); await lib.hideDevBadge(ctx); if (SIDE === 'customer') { await ctx.addCookies([{ name: 'myseouldrop_locale', value: LOCALE, url: ORIGIN }]); } if (SIDE === 'customer') await ctx.addInitScript(l => { try { localStorage.setItem('myseouldrop.locale', l); } catch {} document.cookie = `myseouldrop_locale=${l}; path=/`; }, LOCALE); return ctx; };
  const run = async (p, id, opts = {}) => {
    const errs = p.__errs.splice(0);
    if (!opts.keepScroll) { await p.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; }); await sleep(300); }
    const scope = opts.scope || (opts.modal ? MODAL : null);
    await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: 'jpeg', quality: 72 });
    if (W >= 1000 && !opts.modal) await p.screenshot({ path: path.join(OUT, `${id}-full.jpg`), type: 'jpeg', quality: 65, fullPage: true });
    const layout = await p.evaluate(lib.auditInPage, { mobile: TOUCH, scope: scope ? (await p.locator(scope).count() ? scope : null) : null });
    const clearance = scope ? [] : await p.evaluate(lib.bottomClearanceInPage);
    const hits = await p.evaluate(lib.hitTestInPage, { scope: scope && (await p.locator(scope).count()) ? scope : null });
    const result = { id, side: SIDE, locale: LOCALE, viewport: `${W}x${H}`, url: new URL(p.url()).pathname, note: opts.note || '', errors: errs.concat(p.__errs.splice(0)), layout, clearance, hits };
    fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(result, null, 1));
    const n = k => (layout[k] || []).length;
    summary.push(`${id}: overflow=${layout.pageOverflow ? 'YES' : 0} clip=${n('clipped')} spill=${n('spills')} off=${n('offscreen')} wraps=${n('controlWraps')} breaks=${layout.wordBreaks.filter(x => !x.forced).length}/${n('wordBreaks')} orphan=${n('orphans')} overlap=${n('overlaps')} select=${n('selectClipped')} ph=${n('placeholderClipped')} small=${n('smallTargets')} hidden=${clearance.length} covered=${hits.length} err=${result.errors.length}`);
    console.log(summary[summary.length - 1]);
  };
  const watch = p => { p.__errs = []; p.on('pageerror', e => p.__errs.push('pageerror: ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|Download the React DevTools|\[HMR\]/.test(m.text())) p.__errs.push('console: ' + m.text().slice(0, 200)); }); p.setDefaultTimeout(45000); p.setDefaultNavigationTimeout(120000); };
  try {
    if (SIDE === 'admin') {
      const ctx = await newCtx(); const p = await ctx.newPage(); watch(p);
      await lib.login(p, ORIGIN, access.partner, '/partner'); await settle(p);
      for (const s of ADMIN) {
        if (ONLY && !ONLY.has(s.id)) continue; if (s.mobileOnly && W > 800) continue;
        try {
          await p.goto(ORIGIN + s.url, { waitUntil: 'domcontentloaded' }); await settle(p);
          const ok = s.setup ? await s.setup(p) : true;
          if (ok === false) { console.log(`${s.id}: setup failed (state not reachable)`); summary.push(`${s.id}: SETUP-FAILED`); continue; }
          await run(p, s.id, { modal: s.modal, scope: s.scope, keepScroll: !!s.setup });
          if (s.modal) { await p.keyboard.press('Escape'); await sleep(400); }
        } catch (e) { console.log(`${s.id}: ERROR ${e.message.split('\n')[0]}`); summary.push(`${s.id}: ERROR ${e.message.split('\n')[0]}`); }
      }
    } else {
      const g = await newCtx(); const gp = await g.newPage(); watch(gp);
      await guestJourney(gp, (id, o) => run(gp, id, o)).catch(e => console.log('guest ERROR ' + e.message.split('\n')[0])); await g.close();
      const ctx = await newCtx(); const c = await ctx.newPage(); watch(c);
      await lib.login(c, ORIGIN, access.customer, '/bookings');
      await customerJourney(c, (id, o) => (ONLY && !ONLY.has(id)) ? Promise.resolve() : run(c, id, o)).catch(e => console.log('journey ERROR ' + e.message.split('\n').slice(0, 3).join(' | ')));
    }
  } finally {
    fs.writeFileSync(path.join(OUT, 'summary.txt'), summary.join('\n') + '\n');
    await browser.close();
  }
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
