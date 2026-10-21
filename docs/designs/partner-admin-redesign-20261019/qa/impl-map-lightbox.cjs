// Map sheet → full detail → photo lightbox: portal outside the transformed
// sheet, viewport coverage, initial focus, arrow keys, Tab trap, Esc restore.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const ORIGIN = process.env.QA_IMPL_URL || 'http://127.0.0.1:3113'; const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const PHOTO_PLACE = process.env.PLACE || 'ados-63-skypicnic';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = []; const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 220) : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' });
  const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(90000);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const hits = []; p.on('request', r => { const u = r.url(); if (/\/api\/places\/[^/]+\/(profile|media)$/.test(u)) hits.push(u.replace(ORIGIN, '')); });
  await p.goto(`${ORIGIN}/map?place=${PHOTO_PLACE}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.mapsheet', { timeout: 150000 }); await sleep(5000);
  const handle = p.getByRole('button', { name: /Press to fully expand/ }).first();
  check('map.handle', (await handle.count()) === 1, `labels=${(await p.locator('.mapsheet [role=button]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))).join(' | ').slice(0, 200)}`);
  if (await handle.count()) { await handle.click(); await sleep(2000); }
  check('map.detail.open', (await p.locator('.mapsheet-detail-body .detail-scroll').count()) === 1, `detail=${await p.locator('.mapsheet-detail-body .detail-scroll').count()}`);
  check('map.profileFetched', hits.some(h => h.endsWith('/profile')) && hits.some(h => h.endsWith('/media')), hits.join(', '));
  await p.screenshot({ path: path.join(OUT, 'map-detail.png') });
  const tile = p.locator('.mapsheet .place-photo-tile').first();
  check('map.detail.tiles', (await tile.count()) >= 1, `tiles=${await tile.count()}`);
  await tile.focus(); await tile.click(); await sleep(1000);
  const lb = await p.evaluate(() => { const el = document.querySelector('.photo-lightbox'); if (!el) return null; const r = el.getBoundingClientRect(); return { inSheet: !!el.closest('.mapsheet'), parent: el.parentElement?.className, x: r.x, y: r.y, w: Math.round(r.width), h: Math.round(r.height), active: document.activeElement?.getAttribute('aria-label'), counter: el.querySelector('.photo-lightbox-nav span')?.textContent?.trim() }; });
  check('lightbox.portal', !!lb && !lb.inSheet && /app-shell/.test(lb.parent || ''), JSON.stringify(lb));
  check('lightbox.coversViewport', !!lb && lb.x === 0 && lb.y === 0 && lb.w === 390 && lb.h === 844, JSON.stringify(lb));
  check('lightbox.initialFocus', !!lb && lb.active === 'Close photos', `active=${lb && lb.active}`);
  check('lightbox.counter', !!lb && /^1 \/ \d+$/.test(lb.counter || ''), lb && lb.counter);
  await p.screenshot({ path: path.join(OUT, 'map-lightbox-open.png') });
  await p.keyboard.press('ArrowRight'); await sleep(900);
  const c2 = (await p.locator('.photo-lightbox-nav span').textContent().catch(() => '')) || '';
  check('lightbox.arrowRight', /^2 \//.test(c2.trim()), c2);
  // CSS locators: with the sheet and the lightbox both aria-modal, Playwright's role query treats each as outside the other.
  await p.locator('.photo-lightbox button[aria-label="Previous photo"]').click(); await sleep(900);
  const c3 = (await p.locator('.photo-lightbox-nav span').textContent().catch(() => '')) || '';
  check('lightbox.prevButton', /^1 \//.test(c3.trim()), c3);
  let inside = true; const seen = [];
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); const s = await p.evaluate(() => ({ in: !!document.activeElement?.closest('.photo-lightbox'), l: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName })); seen.push(s.l); if (!s.in) inside = false; }
  check('lightbox.tabTrapped', inside, seen.join(' > '));
  await p.keyboard.press('Shift+Tab');
  check('lightbox.shiftTabTrapped', await p.evaluate(() => !!document.activeElement?.closest('.photo-lightbox')));
  check('lightbox.bodyLocked', (await p.evaluate(() => document.body.style.overflow)) === 'hidden');
  // F4: everything else under the portal host is inert while open
  const inertInfo = await p.evaluate(() => ({ sheetInert: !!document.querySelector('.mapsheet')?.closest('[inert]'), lightboxInert: !!document.querySelector('.photo-lightbox')?.closest('[inert]'), inertCount: document.querySelectorAll('.app-shell > [inert]').length }));
  check('lightbox.backgroundInert', inertInfo.sheetInert && !inertInfo.lightboxInert && inertInfo.inertCount >= 1, JSON.stringify(inertInfo));
  // F3: a vertical drag inside the gallery must not fold the map sheet behind it
  const before = await p.evaluate(() => ({ cls: document.querySelector('.mapsheet')?.className, y: Math.round(document.querySelector('.mapsheet')?.getBoundingClientRect().top || 0) }));
  await p.mouse.move(195, 420); await p.mouse.down(); for (let y = 420; y <= 760; y += 40) { await p.mouse.move(195, y); await sleep(16); } await p.mouse.up(); await sleep(700);
  const after = await p.evaluate(() => ({ cls: document.querySelector('.mapsheet')?.className, y: Math.round(document.querySelector('.mapsheet')?.getBoundingClientRect().top || 0), lightbox: document.querySelectorAll('.photo-lightbox').length, detail: document.querySelectorAll('.mapsheet-detail-body .detail-scroll').length }));
  check('lightbox.dragDoesNotMoveSheet', after.lightbox === 1 && after.detail === 1 && after.cls === before.cls && Math.abs(after.y - before.y) <= 1, JSON.stringify({ before, after }));
  await p.keyboard.press('Escape'); await sleep(800);
  check('lightbox.escapeCloses', (await p.locator('.photo-lightbox').count()) === 0);
  check('lightbox.focusRestored', await p.evaluate(() => !!document.activeElement?.classList.contains('place-photo-tile')), await p.evaluate(() => document.activeElement?.className));
  check('lightbox.bodyUnlocked', (await p.evaluate(() => document.body.style.overflow)) !== 'hidden');
  check('lightbox.inertRestored', (await p.evaluate(() => document.querySelectorAll('.app-shell [inert], .app-shell > [inert]').length)) === 0);
  // × button path too
  await tile.click(); await sleep(800); await p.locator('.photo-lightbox button[aria-label="Close photos"]').click(); await sleep(600);
  check('lightbox.closeButton', (await p.locator('.photo-lightbox').count()) === 0);
  check('errors.none', errs.length === 0, errs.join(' | '));
  await b.close(); console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 16).join(' | ')); process.exit(1); });
