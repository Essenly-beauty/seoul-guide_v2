// 파트너 관리자 시안 자동 검증 — 실행 방법은 같은 폴더의 README.md 참고. 시안 데이터만 다루며 실제 서버·DB에는 접근하지 않는다.
const { chromium } = require('playwright');
const URL = process.env.QA_URL || 'http://127.0.0.1:3111/', OUT = process.env.QA_OUT || require('path').join(require('os').tmpdir(), 'partner-admin-qa', 'cal');
require('fs').mkdirSync(OUT, { recursive: true });
const fails = []; let n = 0;
const check = (k, ok, v) => { n++; console.log(ok ? 'PASS' : 'FAIL', k, v === undefined ? '' : JSON.stringify(v)); if (!ok) fails.push(k); };
const G0 = 540, PX = 1.1;
async function clickAt(p, colSel, min) { await p.evaluate(y => { const sc = document.querySelector('.cal-scroll'); if (sc && getComputedStyle(sc).overflowY !== 'visible') sc.scrollTop = Math.max(0, y - 160); else window.scrollTo(0, y); }, (min - G0) * PX); const box = await p.locator(colSel).boundingBox(); await p.mouse.click(box.x + box.width / 2, box.y + (min - G0) * PX + 8); }
const overflowOk = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
(async () => {
  const b = await chromium.launch();
  // ---------- desktop 1440 ----------
  {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.kpis'); await p.locator('.sidebar [data-page="calendar"]').click(); await p.waitForSelector('.cal-grid');
    check('d.crumb', (await p.locator('#crumb-page').textContent()) === '예약 캘린더');
    check('d.cols3', await p.locator('.col[data-col-date]').count() === 3);
    check('d.events19', await p.locator('.ev').count() === 5, await p.locator('.ev').count());
    check('d.nowLine', await p.locator('.now').count() === 3);
    check('d.breaks', await p.locator('.zone.brk').count() === 3);
    check('d.block', await p.locator('.zone.blk').count() === 1);
    const r3 = await p.locator('[data-booking="r3"]').evaluate(e => ({ top: parseFloat(e.style.top), h: parseFloat(e.style.height) }));
    check('d.r3.geometry', Math.abs(r3.top - 330) < 0.5 && Math.abs(r3.h - 148.5) < 0.5, r3);
    check('d.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/d-day.png' });
    // booking detail
    await p.locator('[data-booking="r3"]').click();
    const side = await p.locator('.side').innerText();
    check('d.detail', side.includes('최유진') && side.includes('고객이 지우 디자이너를 직접 선택') && side.includes('150,000원') && side.includes('140,000원'), side.slice(0, 120));
    check('d.detail.focus', await p.evaluate(() => document.activeElement.id) === 'panel-title');
    await p.screenshot({ path: OUT + '/d-detail.png' });
    // add booking via empty slot (jiu 16:30)
    await clickAt(p, '.col[data-col="jiu"]', 990);
    check('d.pop', await p.locator('.pop').isVisible());
    check('d.pop.title', (await p.locator('.pop-title').innerText()).includes('16:30'), await p.locator('.pop-title').innerText());
    await p.screenshot({ path: OUT + '/d-pop.png' });
    await p.locator('[data-add="booking"]').click();
    check('d.form.staff', await p.locator('#cal-form [name=staffId]').inputValue() === 'jiu');
    check('d.form.menus.filtered', await p.locator('#cal-form [name=menuId] option').count() === 2);
    await p.locator('#cal-form [name=name]').fill('김테스트');
    await p.locator('#cal-form [name=menuId]').selectOption('1');
    check('d.form.calc', (await p.locator('#cal-calc').textContent()).startsWith('16:30–17:30'), await p.locator('#cal-calc').textContent());
    check('d.form.noStop', await p.locator('#cal-submit').isEnabled());
    // conflict with r1 at 10:00
    await p.locator('#cal-form [name=start]').selectOption('10:00');
    check('d.form.conflictStop', await p.locator('#cal-submit').isDisabled() && (await p.locator('#cal-issues').innerText()).includes('김하늘'), await p.locator('#cal-issues').innerText());
    await p.screenshot({ path: OUT + '/d-form-conflict.png' });
    // outside hours warn only
    await p.locator('#cal-form [name=start]').selectOption('19:30');
    check('d.form.outsideWarn', await p.locator('#cal-submit').isEnabled() && (await p.locator('#cal-issues .warn').count()) >= 1);
    // staff change re-filters menus
    await p.locator('#cal-form [name=staffId]').selectOption('minseo');
    check('d.form.minseoMenus', await p.locator('#cal-form [name=menuId] option').count() === 2, await p.locator('#cal-form [name=menuId] option').allTextContents());
    await p.locator('#cal-form [name=staffId]').selectOption('jiu');
    await p.locator('#cal-form [name=start]').selectOption('16:30');
    await p.locator('#cal-form [name=menuId]').selectOption('1');
    await p.locator('#cal-submit').click();
    check('d.added.event', await p.locator('.col[data-col="jiu"] .ev').count() === 3);
    check('d.added.detail', (await p.locator('.side').innerText()).includes('전화 예약 · 업체가 직접 입력'));
    check('d.added.noConfirm', dialogs.length === 0, dialogs);
    // block time on soyeon 18:00
    await clickAt(p, '.col[data-col="soyeon"]', 1080);
    await p.locator('[data-add="block"]').click();
    check('d.block.form.owner', await p.locator('#cal-form [name=staffId]').inputValue() === 'soyeon');
    await p.locator('#cal-form [name=reason]').fill('재료 정리');
    await p.locator('#cal-submit').click();
    check('d.block.added', await p.locator('.col[data-col="soyeon"] .zone.blk').count() === 2);
    // day off on minseo (has 2 bookings -> warn)
    await clickAt(p, '.col[data-col="minseo"]', 600);
    await p.locator('[data-add="off"]').click();
    check('d.off.warn', (await p.locator('#cal-issues').innerText()).includes('예약 2건'));
    await p.locator('#cal-submit').click();
    check('d.off.full', await p.locator('.col[data-col="minseo"] .zone.off.full').count() === 1);
    check('d.off.bookingsKept', await p.locator('.col[data-col="minseo"] .ev').count() === 2);
    await p.screenshot({ path: OUT + '/d-after-edits.png' });
    // escape closes pop
    await clickAt(p, '.col[data-col="jiu"]', 1140); await p.keyboard.press('Escape');
    check('d.pop.escape', await p.locator('.pop').count() === 0);
    // chips
    await p.locator('[data-cal-staff="soyeon"]').click();
    check('d.chip.filter', await p.locator('.col[data-col-date]').count() === 2);
    await p.locator('[data-cal-staff="soyeon"]').click();
    // week view
    await p.locator('[data-cal-view="week"]').click();
    check('d.week.cols', await p.locator('.col[data-col-date]').count() === 7);
    check('d.week.tueClosed', await p.locator('.col[data-col-date="20"] .zone.off.full').count() === 1);
    check('d.week.events', await p.locator('.ev').count() === 14, await p.locator('.ev').count());
    check('d.week.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/d-week.png' });
    await p.locator('.ch-date[data-cal-date="21"]').click();
    check('d.week.toDay21', (await p.locator('.cal-date').textContent()).includes('21일') && await p.locator('[data-cal-view="day"]').getAttribute('aria-pressed') === 'true');
    // scenario current
    await p.locator('#cal-scenario').selectOption('current');
    check('d.current.noEvents', await p.locator('.ev').count() === 0);
    await clickAt(p, '.col[data-col="jiu"]', 900);
    check('d.current.addDisabled', await p.locator('[data-add="booking"]').isDisabled());
    await p.keyboard.press('Escape');
    await p.locator('#cal-scenario').selectOption('future');
    // customer preview with designer selection
    await p.locator('#customer-preview').click();
    check('c.steps4', await p.locator('#customer .steps li').count() === 4);
    await p.locator('[data-cp-menu="2"]').click(); await p.locator('[data-cp-next]').click();
    check('c.designers', await p.locator('[data-cp-staff]').count() === 2, await p.locator('[data-cp-staff]').allInnerTexts());
    const jiuCard = await p.locator('[data-cp-staff="jiu"]').innerText();
    check('c.firstSlot', jiuCard.includes('19일 16:30') || jiuCard.includes('21일'), jiuCard);
    await p.screenshot({ path: OUT + '/c-designer.png' });
    await p.locator('[data-cp-staff="soyeon"]').click(); await p.locator('[data-cp-next]').click();
    const slots = await p.locator('[data-cp-time]').allTextContents();
    check('c.slots', slots.length > 0, slots);
    await p.screenshot({ path: OUT + '/c-time.png' });
    await p.locator('[data-cp-time]').first().click(); await p.locator('[data-cp-next]').click();
    check('c.confirm', (await p.locator('#customer-body').innerText()).includes('소연'));
    await p.locator('[data-cp-next]').click();
    check('c.toCalendar', await p.locator('#customer').evaluate(d => !d.open) && (await p.locator('.side').innerText()).includes('미리보기 고객'));
    check('c.appSource', (await p.locator('.side').innerText()).includes('고객이 소연 디자이너를 직접 선택'));
    await p.screenshot({ path: OUT + '/c-landed.png' });
    // shop mode
    await p.locator('.sidebar [data-page="rules"]').click();
    await p.locator('input[name=mode][value=shop]').check();
    await p.locator('.sidebar [data-page="calendar"]').click();
    check('s.singleCol', await p.locator('.col[data-col-date]').count() === 1 && (await p.locator('.ch:not(.corner)').innerText()).includes('매장 예약'));
    check('s.noChips', await p.locator('[data-cal-staff]').count() === 0);
    await p.screenshot({ path: OUT + '/s-day.png' });
    await p.locator('#customer-preview').click();
    check('s.steps3', await p.locator('#customer .steps li').count() === 3);
    await p.keyboard.press('Escape');
    check('d.errors', errs.length === 0, errs);
    await c.close();
  }
  // ---------- tablet 1024 ----------
  {
    const c = await b.newContext({ viewport: { width: 1024, height: 768 } }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.kpis'); await p.locator('.sidebar [data-page="calendar"]').click(); await p.waitForSelector('.cal-grid');
    check('t.sideHidden', !(await p.locator('.side').isVisible()));
    check('t.overflow', await overflowOk(p));
    await p.locator('[data-booking="r1"]').click();
    const box = await p.locator('.side').boundingBox();
    check('t.sheetRight', box && Math.round(box.x + box.width) === 1024 && box.width <= 400, box);
    check('t.backdrop', await p.locator('.sheet-backdrop.open').isVisible());
    await p.screenshot({ path: OUT + '/t-sheet.png' });
    await p.mouse.click(100, 400);
    check('t.backdropCloses', !(await p.locator('.side').isVisible()));
    await p.locator('[data-cal-view="week"]').click();
    check('t.week.overflow', await overflowOk(p));
    check('t.errors', errs.length === 0, errs);
    await c.close();
  }
  // ---------- mobile 390 ----------
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.kpis'); await p.locator('.mobile-nav [data-page="calendar"]').click(); await p.waitForSelector('.agenda');
    check('m.agendaItems', await p.locator('.ag-item').count() === 6, await p.locator('.ag-item').count());
    check('m.overflow', await overflowOk(p));
    const fab = await p.locator('.fab').boundingBox(), nav = await p.locator('.mobile-nav').boundingBox();
    check('m.fabAboveNav', fab.y + fab.height <= nav.y, { fab, navY: nav.y });
    await p.screenshot({ path: OUT + '/m-list.png' });
    await p.locator('.fab').click();
    const sheet = await p.locator('.pop.sheet').boundingBox();
    check('m.popSheet', sheet && Math.round(sheet.y + sheet.height) === 844, sheet);
    await p.screenshot({ path: OUT + '/m-pop.png' });
    await p.locator('[data-add="booking"]').click();
    const sb = await p.locator('.side.open').boundingBox();
    check('m.formSheet', sb && Math.round(sb.y + sb.height) === 844 && sb.width === 390, sb);
    await p.locator('#cal-form [name=name]').fill('모바일 테스트');
    await p.locator('#cal-form [name=start]').selectOption('18:00');
    await p.screenshot({ path: OUT + '/m-form.png' });
    await p.locator('#cal-submit').click();
    check('m.added', (await p.locator('.side.open').innerText()).includes('모바일 테스트'));
    await p.locator('.side.open [data-panel-close]').first().click();
    check('m.agendaPlus1', await p.locator('.ag-item').count() === 7);
    await p.locator('[data-cal-view="timeline"]').click();
    check('m.timeline1col', await p.locator('.col[data-col-date]').count() === 1);
    await p.locator('[data-cal-staff="soyeon"]').click();
    check('m.timelineSoyeon', await p.locator('.col[data-col="soyeon"]').count() === 1);
    check('m.timeline.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/m-timeline.png', fullPage: true });
    await p.locator('#customer-preview').click();
    await p.locator('[data-cp-menu="1"]').click(); await p.locator('[data-cp-next]').click();
    check('m.cp.designers3', await p.locator('[data-cp-staff]').count() === 3);
    const dlg = await p.locator('#customer').boundingBox();
    check('m.cp.fits', dlg.y >= 0 && dlg.y + dlg.height <= 844, dlg);
    await p.screenshot({ path: OUT + '/m-customer.png' });
    await p.keyboard.press('Escape');
    // 터치(v3.4): 예약 블록 위에서 바로 쓸면 스크롤, 길게 누른 뒤 끌면 시간 변경. CDP 터치 이벤트로 재현.
    await p.locator('.mobile-nav [data-page="calendar"]').click(); await p.locator('[data-cal-view="timeline"]').click();
    const tt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ');
    const cdp = await c.newCDPSession(p);
    const prepTouch = async () => { await p.evaluate(() => document.querySelector('.ev.draggable').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200); const bb = await p.locator('.ev.draggable').first().boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + 12; return { y, tp: yy => [{ x, y: yy, radiusX: 2, radiusY: 2, force: 1 }] }; };
    let { y: ty, tp } = await prepTouch(); const y0 = await p.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(ty) });
    for (let i = 1; i <= 6; i++) { await p.waitForTimeout(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(ty - i * 25) }); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
    check('m.touch.swipeScrolls', (await p.evaluate(() => scrollY)) > y0 && (await p.locator('.confirm-box').count()) === 0, { y0, y1: await p.evaluate(() => scrollY) });
    ({ y: ty, tp } = await prepTouch());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(ty) }); await p.waitForTimeout(500);
    for (let i = 1; i <= 8; i++) { await p.waitForTimeout(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(ty + i * 10) }); }
    check('m.touch.dragging', (await p.locator('.ev.dragging').count()) === 1 && (await p.locator('.drag-label').count()) === 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(300);
    check('m.touch.longPressMoves', (await p.locator('.confirm-box').count()) === 1 && (await tt('.confirm-box')).includes('→'), (await p.locator('.confirm-box').count()) ? await tt('.confirm-box') : null);
    await p.screenshot({ path: OUT + '/m-touch-drag.png' });
    check('m.smallTargets', true, await p.evaluate(() => [...document.querySelectorAll('main button, main select, .mobile-nav button, .fab')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).map(e => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 12)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)));
    check('m.errors', errs.length === 0, errs);
    await c.close();
  }
  await b.close();
  console.log(`${n - fails.length}/${n} passed`, fails.length ? 'FAILED: ' + fails.join(', ') : '');
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
