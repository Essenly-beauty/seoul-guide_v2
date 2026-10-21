// 버튼·링크·탭·선택 상자를 하나씩 눌러 "눌렀는데 아무 일도 안 일어나는" 컨트롤과 오류를 찾는다 (2026-10-21).
// 효과로 인정: 주소 이동, 창·시트·메뉴 열림/닫힘, 화면 글자 변화, 눌림/펼침/선택 상태 변화, 서버 요청, 새 탭, 스크롤·포커스 이동.
// 저장·확정·전송·삭제·로그아웃 같은 확정 버튼과 창 안의 제출 버튼은 누르지 않는다(실제 흐름 스크립트로 따로 확인).
// 바로 저장되는 토글은 누른 뒤 다시 눌러 되돌린다. 외부 링크는 주소만 확인한다.
// 실행: NODE_PATH=$PWD/node_modules CTRL_SIDE=admin CTRL_VIEWPORT=1440x900 [CTRL_PAGES=home,bookings] [CTRL_LOCALE=en] [CTRL_OUT=dir] node docs/designs/partner-admin-redesign-20261019/qa/impl-controls-audit.cjs
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const lib = require('./layout-audit-lib.cjs'); const { sleep, settle } = lib;
const ROOT = path.resolve(__dirname, '../../../..');
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
const SIDE = process.env.CTRL_SIDE || 'admin'; const LOCALE = process.env.CTRL_LOCALE || (SIDE === 'admin' ? 'ko' : 'en');
const [W, H] = (process.env.CTRL_VIEWPORT || '1440x900').split('x').map(Number); const TOUCH = W <= 1024;
const ONLY = process.env.CTRL_PAGES ? new Set(process.env.CTRL_PAGES.split(',')) : null;
const OUT = path.join(process.env.CTRL_OUT || path.join(os.tmpdir(), 'controls-audit'), `${SIDE}-${LOCALE}-${W}x${H}`); fs.mkdirSync(OUT, { recursive: true });
const PLACE = process.env.PLACE || 'myseouldrop-booking-studio';
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const t = lib.loadTranslations(ROOT)(LOCALE === 'ko' ? 'en' : LOCALE);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMMIT_KO = /^(저장|저장하기|변경 사항 저장|변경사항 저장|모두 저장|확정|예약 확정|변경 확정|보내기|메시지 보내기|삭제|삭제하기|비활성화|활성화|게시|게시하기|공개하기|비공개|내리기|적용|등록|등록하기|확인|예|네|로그아웃|탈퇴|방문 완료|미방문|업로드|사진 추가|초기화|되돌리기|발행|운영 시작|승인 요청|제출|휴무 추가|추가하기|복사)$/;
const COMMIT_EN = ['Send booking request', 'Confirm booking', 'Send message', 'Sign out', 'Log out', 'Delete', 'Save', 'Submit', 'Write a review', 'Write the first review', 'Yes, cancel', 'Cancel booking'].map(x => t(x));
const isCommit = (name, inDialog) => {
  const n = name.replace(/\s+/g, ' ').trim();
  if (COMMIT_KO.test(n)) return true;
  if (COMMIT_EN.some(x => n === x || n.startsWith(x))) return inDialog || !/^(Cancel booking|予約をキャンセル|取消预约|Cancelar reserva|Annuler la réservation)$/.test(n);
  if (inDialog && /^(예약 추가|예약 취소|시간 변경|변경|추가|저장)$/.test(n)) return true; // 창 안에서는 제출 버튼
  return false;
};
const CLOSE = /^(닫기|취소|Close|Cancel|Keep booking|×|✕|아니요|돌아가기)$/;

function listControls(scopeSel) {
  const root = (scopeSel && document.querySelector(scopeSel)) || document.body;
  const shown = el => { if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0 || s.pointerEvents === 'none') return false; if (e.parentElement && e.parentElement.tagName === 'DETAILS' && !e.parentElement.open && e.tagName !== 'SUMMARY') return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const nameOf = el => (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.innerText || el.getAttribute('title') || el.value || (el.querySelector('img[alt]') && el.querySelector('img[alt]').alt) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  document.querySelectorAll('[data-qa-ctl]').forEach(e => e.removeAttribute('data-qa-ctl'));
  const items = []; const seenNames = {};
  const els = root.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="radio"], summary, select, input[type="checkbox"], input[type="radio"]');
  let i = 0;
  for (const el of els) {
    let target = el;
    if (el.tagName === 'INPUT' && !shown(el)) { const lab = el.closest('label'); if (lab && shown(lab)) target = lab; else continue; } else if (!shown(el)) continue;
    const name = nameOf(el) || ''; const unnamed = !name && el.tagName !== 'SELECT'; const role = el.getAttribute('role') || (el.tagName === 'INPUT' ? el.type : el.tagName.toLowerCase());
    const n = (seenNames[role + name] = (seenNames[role + name] || 0) + 1);
    const id = String(i++); target.setAttribute('data-qa-ctl', id); if (target !== el) el.setAttribute('data-qa-ctl-input', id);
    items.push({ id, key: `${role}|${name}|${n}`, group: `${role}|${name.replace(/\d+/g, '#')}`, name: name || `(이름 없음 ${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''})`, unnamed, role, tag: el.tagName.toLowerCase(), href: el.getAttribute('href'), targetAttr: el.getAttribute('target'), rel: el.getAttribute('rel'), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true', selected: el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-current') === 'page' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current') === 'true' || (el.type === 'radio' && el.checked), inDialog: !!el.closest('[role="dialog"], [role="alertdialog"], dialog, .live-modal'), inMain: !!el.closest('main'), type: el.getAttribute('type') || '', primary: /primary/.test(el.className || '') });
  }
  return items;
}
function snap(id) {
  const el = id != null ? document.querySelector(`[data-qa-ctl="${id}"]`) : null; const input = id != null ? document.querySelector(`[data-qa-ctl-input="${id}"]`) : null;
  const body = document.body.innerText; let h = 0; for (let i = 0; i < body.length; i++) h = (h * 31 + body.charCodeAt(i)) | 0;
  const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open], .live-modal, [role="menu"], [role="listbox"], #more-menu[open]')].filter(d => { const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
  const details = document.querySelectorAll('details[open]').length;
  const scrolls = [...document.querySelectorAll('*')].reduce((a, e) => a + (e.scrollTop | 0) + (e.scrollLeft | 0), 0);
  const c = input || el;
  return { url: location.href, h, dialogs, details, sy: Math.round(scrollY) + scrolls, focus: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.tagName + (document.activeElement.id ? '#' + document.activeElement.id : '') + (document.activeElement.getAttribute('data-qa-ctl') || '')) : '', state: c ? [c.getAttribute('aria-pressed'), c.getAttribute('aria-expanded'), c.getAttribute('aria-selected'), c.getAttribute('aria-checked'), c.checked, c.value, c.open, c.className].join('|') : 'gone' };
}

const ADMIN_PAGES = [
  ['home', '/partner'], ['calendar', '/partner/calendar'], ['bookings', '/partner/bookings'], ['customers', '/partner/customers'], ['messages', '/partner/messages'],
  ['statistics', '/partner/statistics'], ['services', '/partner/services'], ['staff', '/partner/staff'], ['availability', '/partner/availability'], ['roster', '/partner/roster'],
  ['rules', '/partner/rules'], ['settlement', '/partner/settlement'], ['settings', '/partner/settings'],
].map(([id, url]) => ({ id, url }));
const pendingRow = async p => { const b = p.locator('main [role="group"][aria-label="예약 기간"] button').filter({ hasText: /^전체$/ }).first(); if (await b.count()) { await b.click(); await sleep(1500); } const cands = p.locator('main tr, main li, main [role="listitem"]').filter({ hasText: /확인 대기/ }); for (let i = 0; i < await cands.count(); i++) { const x = (await cands.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' '); if (/\d{1,2}:\d{2}/.test(x) && x.length < 260) { await cands.nth(i).click(); await sleep(1500); return true; } } return false; };
ADMIN_PAGES.push(
  { id: 'booking-detail', url: '/partner/bookings', setup: pendingRow, onlyNew: 'bookings' },
  { id: 'calendar-detail', url: '/partner/calendar', setup: async p => { const b = p.locator('[data-calendar-booking]').first(); if (!(await b.count())) return false; await b.click(); await sleep(1500); return true; }, onlyNew: 'calendar' },
  { id: 'messages-thread', url: '/partner/messages', setup: async p => { const th = p.locator('.msg-list [role="listitem"] button').first(); if (!(await th.count())) return false; await th.click(); await p.locator('main textarea').first().waitFor({ timeout: 45000 }).catch(() => {}); await sleep(1000); return true; }, onlyNew: 'messages' },
  { id: 'booking-add-dialog', url: '/partner/bookings', scope: '.live-modal', setup: async p => { await p.getByRole('button', { name: /예약 추가/ }).first().click(); await sleep(1200); return (await p.locator('.live-modal').count()) > 0; } },
  { id: 'reschedule-dialog', url: '/partner/bookings', scope: '.live-modal', setup: async p => { if (!await pendingRow(p)) return false; await p.getByRole('button', { name: '시간 변경', exact: true }).first().click(); await sleep(1800); return (await p.locator('.live-modal').count()) > 0; } },
  { id: 'cancel-dialog', url: '/partner/bookings', scope: '.live-modal', setup: async p => { if (!await pendingRow(p)) return false; await p.getByRole('button', { name: '예약 취소', exact: true }).first().click(); await sleep(1200); return (await p.locator('.live-modal').count()) > 0; } },
);
if (W <= 800) ADMIN_PAGES.push({ id: 'more-menu', url: '/partner', scope: '#more-menu', setup: async p => { const b = p.locator('nav.mobile-nav button').filter({ hasText: '더보기' }).first(); if (!(await b.count())) return false; await b.click(); await sleep(600); return true; } });

const flowTo = step => async p => {
  const services = p.locator(`[role="group"][aria-label="${t('Choose a service')}"] button`); await services.first().waitFor({ timeout: 90000 }); await sleep(600);
  if (step === 'menu') return true;
  await services.first().click(); await sleep(700); const next = async en => { const b = p.locator('button').filter({ hasText: t(en) }).last(); await b.click(); await sleep(1500); };
  await next('Choose your staff'); if (step === 'staff') return true;
  await p.locator(`[role="group"][aria-label="${t('Choose your staff')}"] button`).first().click(); await sleep(600); await next('Choose a date & time'); await sleep(1500);
  if (step === 'datetime') return true;
  const days = p.locator(`[role="group"][aria-label="${t('Choose a date')}"] button`);
  for (const i of [2, 3, 1, 4]) { if (i >= await days.count()) continue; await days.nth(i).click(); await sleep(2200); const slots = p.locator('button').filter({ hasText: /^\s*\d{1,2}[:h]\d{2}\s*$/ }); const free = await slots.evaluateAll(els => els.map((e, k) => (!e.disabled ? k : -1)).filter(k => k >= 0)); if (free.length) { await slots.nth(free[0]).click(); await sleep(800); break; } }
  await next('Review booking'); await sleep(2500); return true;
};
const detailHref = async (p, statusEn) => { await p.goto(ORIGIN + '/bookings', { waitUntil: 'domcontentloaded' }); for (let i = 0; i < 200 && !(await p.getByRole('link', { name: t('View booking') }).count()); i++) await sleep(700); return p.evaluate(l => { for (const a of document.querySelectorAll('a')) { if (!a.textContent.includes(l.view)) continue; let el = a.parentElement; while (el && el.querySelectorAll('a').length === 1) { if (el.textContent.includes(l.status)) return a.getAttribute('href'); el = el.parentElement; } } return null; }, { view: t('View booking'), status: t(statusEn) }); };
const CUSTOMER_PAGES = [
  { id: 'place', url: `/place/${PLACE}` },
  { id: 'book-menu', url: `/place/${PLACE}/book`, setup: flowTo('menu') },
  { id: 'book-staff', url: `/place/${PLACE}/book`, setup: flowTo('staff') },
  { id: 'book-datetime', url: `/place/${PLACE}/book`, setup: flowTo('datetime') },
  { id: 'book-review', url: `/place/${PLACE}/book`, setup: flowTo('review') },
  { id: 'bookings', url: '/bookings', setup: async p => { for (let i = 0; i < 200 && !(await p.getByRole('link', { name: t('View booking') }).count()); i++) await sleep(700); return true; } },
  { id: 'booking-detail', url: null, resolve: p => detailHref(p, 'Awaiting confirmation'), setup: async p => { for (let i = 0; i < 200 && !(await p.locator('textarea').count()); i++) await sleep(700); await sleep(800); return true; } },
  { id: 'cancel-dialog', url: null, resolve: p => detailHref(p, 'Awaiting confirmation'), scope: '[role="dialog"], [role="alertdialog"], dialog[open]', setup: async p => { for (let i = 0; i < 200 && !(await p.locator('textarea').count()); i++) await sleep(700); const b = p.locator('button').filter({ hasText: new RegExp(`^\\s*${esc(t('Cancel booking'))}\\s*$`) }).first(); if (!(await b.count())) return false; await b.click(); await sleep(1200); return (await p.locator('[role="dialog"], [role="alertdialog"], dialog[open]').count()) > 0; } },
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: TOUCH && W <= 820, hasTouch: TOUCH, locale: LOCALE === 'ko' ? 'ko-KR' : LOCALE });
  await lib.hideDevBadge(ctx); if (SIDE === 'customer') await ctx.addCookies([{ name: 'myseouldrop_locale', value: LOCALE, url: ORIGIN }]);
  if (SIDE === 'customer') await ctx.addInitScript(l => { try { localStorage.setItem('myseouldrop.locale', l); } catch {} }, LOCALE);
  const p = await ctx.newPage(); p.setDefaultTimeout(30000); p.setDefaultNavigationTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 200))); p.on('console', m => { if (m.type() === 'error' && !/favicon|DevTools|\[HMR\]|\[Fast Refresh\]/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  const reqs = []; const live = new Map();
  p.on('request', r => { const u = r.url(); if (/_next\/static|__nextjs|webpack-hmr|_next\/image|\.(png|jpe?g|webp|avif|svg|woff2?|css|js|map)(\?|$)|favicon|basemaps|cartocdn|tile|\/_vercel/.test(u)) return; const o = { m: r.method(), u: u.replace(ORIGIN, '').slice(0, 120), pending: true }; live.set(r, o); reqs.push(o); });
  const done = r => { const o = live.get(r); if (o) { o.pending = false; live.delete(r); } }; p.on('requestfinished', done); p.on('requestfailed', done);
  const popups = []; ctx.on('page', np => { if (np !== p) { popups.push(np.url()); np.close().catch(() => {}); } });
  await lib.login(p, ORIGIN, SIDE === 'admin' ? access.partner : access.customer, SIDE === 'admin' ? '/partner' : '/bookings');
  const pages = SIDE === 'admin' ? ADMIN_PAGES : CUSTOMER_PAGES; const tested = {}; const report = []; const shell = new Set(); let firstPage = true;
  for (const pg of pages) {
    if (ONLY && !ONLY.has(pg.id)) continue;
    const results = []; let url = pg.url;
    const reset = async () => { if (!url && pg.resolve) url = await pg.resolve(p); if (!url) return false; for (let i = 0; i < 3; i++) { try { await p.goto(ORIGIN + url, { waitUntil: 'domcontentloaded' }); break; } catch (e) { if (i === 2) throw e; await sleep(1500); } } await settle(p); if (pg.setup) { const ok = await pg.setup(p).catch(() => false); if (ok === false) return false; } await sleep(400); return true; };
    if (!await reset().catch(() => false)) { report.push({ page: pg.id, error: 'setup failed' }); console.log(`${pg.id}: setup failed`); continue; }
    let items = await p.evaluate(listControls, pg.scope || null); let base = await p.evaluate(snap, null);
    const prior = pg.onlyNew ? new Set(tested[pg.onlyNew] || []) : null; const groups = {};
    const queue = items.filter(it => { if (prior && prior.has(it.key)) return false; if (!it.inMain && !it.inDialog && !pg.scope && !firstPage && shell.has(it.key)) return false; groups[it.group] = (groups[it.group] || 0) + 1; return groups[it.group] <= 2; });
    if (firstPage) { items.filter(it => !it.inMain).forEach(it => shell.add(it.key)); firstPage = false; }
    tested[pg.id] = items.map(it => it.key);
    for (const item of queue) {
      const rec = { key: item.key, name: item.name, role: item.role };
      try {
        if (item.unnamed) rec.issue = 'no accessible name';
        if (item.disabled) { rec.result = 'disabled'; results.push(rec); continue; }
        if (item.href && /^(https?:)?\/\//.test(item.href) && !item.href.startsWith(ORIGIN)) { rec.result = 'external'; rec.href = item.href; rec.issue = item.targetAttr === '_blank' && !/noopener|noreferrer/.test(item.rel || '') ? 'target=_blank without rel=noopener' : ''; results.push(rec); continue; }
        if (item.href && /^(tel:|mailto:|sms:)/.test(item.href)) { rec.result = 'contact-link'; rec.href = item.href; results.push(rec); continue; }
        if (isCommit(item.name, item.inDialog || !!pg.scope) || (pg.scope && (item.type === 'submit'))) { rec.result = 'skipped-commit'; results.push(rec); continue; }
        // find the same control again (DOM may have re-rendered)
        let cur = await p.evaluate(listControls, pg.scope || null); let match = cur.find(c => c.key === item.key);
        if (!match) { rec.result = 'not-found-after-reset'; results.push(rec); continue; }
        const loc = p.locator(`[data-qa-ctl="${match.id}"]`);
        const before = await p.evaluate(snap, match.id); const r0 = reqs.length, e0 = errs.length, pop0 = popups.length;
        if (match.tag === 'select') {
          const opts = await loc.evaluate(s => ({ n: s.options.length, i: s.selectedIndex }));
          if (opts.n < 2) { rec.result = 'select-single-option'; results.push(rec); continue; }
          await loc.selectOption({ index: opts.i === 0 ? 1 : 0 }); await sleep(1300);
        } else {
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await loc.click({ timeout: 5000 });
          await sleep(1300);
          for (let i = 0; i < 6 && reqs.slice(r0).some(r => r.pending); i++) await sleep(300);
        }
        const after = await p.evaluate(snap, match.id);
        const fx = [];
        if (after.url !== before.url) fx.push('navigate:' + after.url.replace(ORIGIN, ''));
        if (after.dialogs !== before.dialogs) fx.push(after.dialogs > before.dialogs ? 'opened' : 'closed');
        if (after.details !== before.details) fx.push(after.details > before.details ? 'expanded' : 'collapsed');
        if (after.h !== before.h) fx.push('content');
        if (after.state !== before.state) fx.push('state');
        if (after.sy !== before.sy) fx.push('scroll');
        if (after.focus !== before.focus) fx.push('focus');
        const net = reqs.slice(r0); if (net.length) fx.push('net:' + net.map(r => r.m + ' ' + r.u).slice(0, 3).join(', '));
        if (popups.length > pop0) fx.push('popup:' + popups.slice(pop0).join(','));
        rec.effects = fx; rec.errors = errs.slice(e0);
        const mutating = net.filter(r => !/^(GET|HEAD|OPTIONS)$/.test(r.m));
        if (mutating.length) { rec.mutating = mutating.map(r => r.m + ' ' + r.u); }
        if (!fx.length) rec.result = item.selected ? 'no-effect(already-selected)' : 'NO-EFFECT';
        else rec.result = 'ok';
        if (rec.errors.length) rec.result = 'ERROR';
        if (fx.length || mutating.length) {
          if (mutating.length && /checkbox|switch|radio/.test(match.role)) { const back = p.locator(`[data-qa-ctl="${match.id}"]`); if (await back.count()) { await back.click({ timeout: 5000 }).catch(() => {}); await sleep(1500); rec.reverted = true; } }
          // a dialog/sheet that opened must close with its own close control or Escape
          if (after.dialogs > before.dialogs) {
            await p.keyboard.press('Escape'); await sleep(500);
            let s2 = await p.evaluate(snap, null);
            if (s2.dialogs > before.dialogs) { const close = p.locator('[role="dialog"] button, dialog[open] button, .live-modal button, [role="alertdialog"] button, #more-menu button').filter({ hasText: CLOSE }).last(); if (await close.count()) { await close.click().catch(() => {}); await sleep(600); } else { const x = p.locator('[role="dialog"] button[aria-label], dialog[open] button[aria-label], .live-modal button[aria-label]').filter({ has: p.locator('svg') }).first(); if (await x.count()) { await x.click().catch(() => {}); await sleep(600); } } s2 = await p.evaluate(snap, null); rec.closeVia = 'button'; } else rec.closeVia = 'escape';
            if (s2.dialogs > before.dialogs) { rec.result = 'DIALOG-NOT-CLOSABLE'; }
          }
          // 가벼운 되돌리기(뒤로 가기·다시 눌러 접기) 후 처음 화면과 같으면 새로 열지 않는다
          let s3 = await p.evaluate(snap, null);
          if (s3.url !== base.url && after.url !== before.url && new URL(s3.url).origin === new URL(base.url).origin) { await p.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(1200); s3 = await p.evaluate(snap, null); }
          if (s3.url === base.url && (s3.dialogs !== base.dialogs || s3.details !== base.details) && /expanded|collapsed|state/.test(fx.join(','))) { const again = p.locator(`[data-qa-ctl="${match.id}"]`); if (await again.count()) { await again.click({ timeout: 3000 }).catch(() => {}); await sleep(700); s3 = await p.evaluate(snap, null); } }
          if (!(s3.url === base.url && s3.dialogs === base.dialogs && s3.details === base.details && s3.h === base.h)) { if (!await reset()) { rec.note = 'reset failed'; results.push(rec); break; } base = await p.evaluate(snap, null); } else rec.softRestore = true;
        }
      } catch (e) {
        rec.result = /intercepts pointer events|not visible|outside of the viewport|element is not stable/.test(e.message) ? 'NOT-CLICKABLE' : 'CRASH'; rec.error = e.message.split('\n').filter(l => /intercepts|waiting|Error|element/.test(l)).slice(0, 4).join(' | ').slice(0, 400);
        await reset().catch(() => {}); base = await p.evaluate(snap, null).catch(() => base);
      }
      results.push(rec);
    }
    const bad = results.filter(r => /NO-EFFECT|ERROR|NOT-CLICKABLE|CRASH|DIALOG-NOT-CLOSABLE/.test(r.result) || r.issue);
    report.push({ page: pg.id, url, tested: results.length, bad: bad.length, results });
    console.log(`${pg.id}: tested=${results.length} bad=${bad.length}${bad.length ? ' → ' + bad.map(b => `${b.result}:${b.name}`).slice(0, 8).join(' / ') : ''}`);
    fs.writeFileSync(path.join(OUT, 'controls.json'), JSON.stringify(report, null, 1));
  }
  await browser.close();
})().catch(e => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
