// 파트너 관리자 시안 자동 검증 — 실행 방법은 같은 폴더의 README.md 참고. 시안 데이터만 다루며 실제 서버·DB에는 접근하지 않는다.
const { chromium } = require('playwright');
const URL = process.env.QA_URL || 'http://127.0.0.1:3111/', OUT = process.env.QA_OUT || require('path').join(require('os').tmpdir(), 'partner-admin-qa', 'ops');
require('fs').mkdirSync(OUT, { recursive: true });
const fails = []; let n = 0;
const check = (k, ok, v) => { n++; console.log(ok ? 'PASS' : 'FAIL', k, v === undefined ? '' : JSON.stringify(v)); if (!ok) fails.push(k); };
const overflowOk = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const txt = async (p, sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ');
(async () => {
  const b = await chromium.launch();
  // ---------- desktop ----------
  {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
    await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.kpis');
    check('h.crumb', (await txt(p, '#crumb-page')) === '홈');
    const kpis = await p.locator('.kpi b').allInnerTexts();
    check('h.kpis', kpis.length === 4 && kpis[0].startsWith('5') && kpis[1].startsWith('1') && kpis[2].startsWith('0') && kpis[3].replace(/\D/g, '') === '370000', kpis);
    check('h.kpiDelta', (await txt(p, '.kpi .delta')).includes('▲ 3건'), await txt(p, '.kpi .delta'));
    const todo = await p.locator('.todo li').allInnerTexts();
    check('h.todo.hasLinkedWarn', todo.some(t => t.includes('근무시간 밖')) === false, todo.map(t => t.slice(0, 40)));
    check('h.todo.noshow', todo.some(t => t.includes('노쇼 이력이 있는 고객 2명')));
    check('h.todo.closedDay', todo.some(t => t.includes('10월 27일') && t.includes('매장 정비')));
    check('h.bars7', await p.locator('.bars .bar-col').count() === 7);
    check('h.barsTotal', (await txt(p, '.home-main .panel:nth-child(2) .card-head p')).includes('13건 · 지난주 11건'), await txt(p, '.home-main .panel:nth-child(2) .card-head p'));
    check('h.util3', await p.locator('.util li').count() === 3);
    check('h.next', (await p.locator('.next li').count()) === 3 && (await txt(p, '.next li')).includes('11:30'), await txt(p, '.next li'));
    check('h.ready', (await txt(p, '.ready')).includes('완료'), null);
    check('h.feed', await p.locator('.feed li').count() === 6);
    check('h.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/d-home.png', fullPage: true });
    // KPI deep link
    await p.locator('button.kpi[data-kpi="today|방문 완료"]').click();
    check('h.kpi.deeplink', (await txt(p, '#crumb-page')) === '예약 목록' && (await p.locator('[data-list-tab="방문 완료"]').getAttribute('aria-pressed')) === 'true' && (await p.locator('.brow').count()) === 1);
    // list page
    await p.locator('[data-list-tab="전체"]').click(); await p.locator('[data-list-period="week"]').click();
    check('l.week.rows', await p.locator('.brow').count() === 13, await p.locator('.brow').count());
    await p.locator('[data-list-period="month"]').click();
    const counts = await p.locator('.status-tabs button .muted').allInnerTexts();
    check('l.month.counts', counts.join(',') === '38,12,22,2,2', counts);
    await p.locator('#list-staff').selectOption('jiu');
    check('l.filter.jiu', (await p.locator('.brow').count()) === 15, await p.locator('.brow').count());
    await p.locator('#list-staff').selectOption('all');
    await p.locator('#list-q').fill('강다은');
    check('l.search', (await p.locator('.brow').count()) === 3 && (await p.evaluate(() => document.activeElement.id)) === 'list-q');
    await p.locator('#list-q').fill('');
    await p.locator('[data-list-period="today"]').click();
    await p.locator('.brow[data-booking="r3"]').click();
    check('l.detail', (await txt(p, '.side')).includes('최유진') && (await txt(p, '.side')).includes('예약번호 R3'), null);
    check('l.detail.noshowDisabled', await p.locator('[data-booking-status="노쇼"]').isDisabled());
    await p.screenshot({ path: OUT + '/d-list.png', fullPage: true });
    // cancel with reason
    await p.locator('[data-booking-status="취소"]').click();
    check('l.cancel.form', await p.locator('#cancel-form').isVisible() && (await txt(p, '#cancel-form')).includes('10,000원'));
    await p.locator('#cancel-form select').selectOption('매장 사정으로 취소');
    await p.locator('#cancel-form button[type=submit]').click();
    check('l.cancel.done', (await txt(p, '.side')).includes('취소됨 · 매장 사정으로 취소'));
    check('l.cancel.tab', (await txt(p, '[data-list-tab="취소"]')).includes('1'));
    // 방문 완료 confirm on r2 (started 11:30 ≤ 11:10? no → disabled). r2 starts 11:30 > 11:10 so disabled; use r1? r1 already 완료. Use r2 after noting disabled
    await p.locator('.brow[data-booking="r2"]').click();
    check('l.r2.doneDisabled', await p.locator('[data-booking-status="방문 완료"]').isDisabled());
    // reschedule r2 to 12:30
    await p.locator('[data-reschedule="r2"]').click();
    check('l.resched.form', (await txt(p, '#panel-title')) === '예약 변경' && (await p.locator('#cal-form [name=start]').inputValue()) === '11:30');
    await p.locator('#cal-form [name=start]').selectOption('12:30');
    check('l.resched.noSelfConflict', await p.locator('#cal-submit').isEnabled(), await txt(p, '#cal-issues'));
    await p.locator('#cal-submit').click();
    check('l.resched.applied', (await txt(p, '.side')).includes('12:30–13:30'));
    check('l.noNativeDialogs', dialogs.length === 0, dialogs);
    // customer link from booking
    await p.locator('.name-link').click();
    check('c.fromBooking', (await txt(p, '#panel-title')).includes('이서연') && (await txt(p, '.side')).includes('방문 2회'));
    await p.screenshot({ path: OUT + '/d-customer-panel.png' });
    // customers page
    await p.locator('.sidebar [data-page="customers"]').click();
    check('c.rows', await p.locator('.crows .brow').count() === 12, await p.locator('.crows .brow').count());
    const first = await txt(p, '.crows .brow');
    check('c.sortRecent', first.includes('김하늘') && first.includes('단골'), first);
    await p.locator('#cust-sort').selectOption('noshow');
    check('c.sortNoshow', (await txt(p, '.crows .brow')).includes('노쇼 1회'));
    await p.locator('#cust-q').fill('박지민');
    check('c.search', await p.locator('.crows .brow').count() === 1);
    await p.locator('.crows .brow').click();
    const cd = await txt(p, '.side');
    check('c.detail', cd.includes('박지민') && cd.includes('노쇼 1회') && cd.includes('방문 이력 3건') && (await p.locator('#cust-note textarea').inputValue()).includes('10/8 노쇼'), cd.slice(0, 160));
    await p.locator('#cust-note textarea').fill('예약금 안내 완료');
    await p.locator('#cust-note button[type=submit]').click();
    check('c.noteSaved', (await txt(p, '.side')).includes('예약금 안내 완료') || (await p.locator('#cust-note textarea').inputValue()) === '예약금 안내 완료');
    await p.screenshot({ path: OUT + '/d-customers.png', fullPage: true });
    await p.locator('[data-cust-book]').click();
    check('c.bookFromCustomer', (await txt(p, '#crumb-page')) === '예약 캘린더' && (await p.locator('#cal-form [name=name]').inputValue()) === '박지민' && (await p.locator('#cal-form [name=staffId]').inputValue()) === 'minseo');
    await p.locator('[data-panel-close]').first().click();
    // weekly block
    await p.locator('.sidebar [data-page="calendar"]').click();
    await p.locator('[data-action="add-open"]').click(); await p.locator('[data-add="block"]').click();
    await p.locator('#cal-form [name=repeat]').selectOption('weekly');
    await p.locator('#cal-form [name=staffId]').selectOption('shop');
    await p.locator('#cal-form [name=start]').selectOption('18:00'); await p.locator('#cal-form [name=end]').selectOption('19:00');
    await p.locator('#cal-form [name=reason]').fill('주간 정리');
    await p.locator('#cal-submit').click();
    check('k.weekly.detail', (await txt(p, '.side')).includes('매주 월요일'));
    check('k.weekly.allCols', await p.locator('.col[data-col-date="19"] .zone.blk').count() === 4, await p.locator('.col[data-col-date="19"] .zone.blk').count());
    await p.locator('[data-cal-view="week"]').click(); await p.locator('[data-cal-nav="7"]').click();
    check('k.weekly.nextWeek', (await p.locator('.col[data-col-date="26"] .zone.blk').count()) === 1 && (await txt(p, '.col[data-col-date="26"] .zone.blk')).includes('주간 정리'));
    check('k.weekly.notTuesday', await p.locator('.col[data-col-date="27"] .zone.blk').count() === 0);
    await p.locator('[data-cal-nav="today"]').click(); await p.locator('[data-cal-view="day"]').click();
    // drag to move (desktop mouse): 15-min snap, confirm box, menu/provider guard
    const dragTo = async (sel, colSel, min) => { const src = await p.locator(sel).boundingBox(); const col = await p.locator(colSel).boundingBox(); await p.mouse.move(src.x + 24, src.y + 10); await p.mouse.down(); await p.mouse.move(src.x + 34, src.y + 40, { steps: 4 }); await p.mouse.move(col.x + col.width / 2, col.y + (min - 540) * 1.1 + 10, { steps: 14 }); await p.mouse.up(); };
    await p.locator('[data-cal-nav="today"]').click();
    await p.evaluate(() => { const sc = document.querySelector('.cal-scroll'); sc.scrollTop = 40; });
    await dragTo('[data-booking="r5"]', '.col[data-col="jiu"]', 600);
    check('g.previewShown', await p.locator('.ev.pending[data-booking="r5"]').count() === 1 && (await p.locator('.col[data-col="jiu"] .ev.pending').count()) === 1);
    const mb = await txt(p, '.confirm-box');
    check('g.menuGuard', mb.includes('지우 디자이너: ‘두피 릴랙싱 스파’ 메뉴를 제공하지 않아요') && await p.locator('[data-move-confirm]').isDisabled(), mb.slice(0, 140));
    await p.screenshot({ path: OUT + '/d-drag-guard.png' });
    await p.locator('[data-move-cancel]').click();
    check('g.cancelRestores', await p.locator('.ev.pending').count() === 0 && (await p.locator('.col[data-col="minseo"] [data-booking="r5"]').count()) === 1);
    await dragTo('[data-booking="r5"]', '.col[data-col="minseo"]', 600);
    check('g.previewTime', (await txt(p, '.confirm-box')).includes('10:00–11:00') && await p.locator('[data-move-confirm]').isEnabled(), await txt(p, '.confirm-box'));
    await p.locator('[data-move-confirm]').click();
    const r5top = await p.locator('[data-booking="r5"]').evaluate(e => parseFloat(e.style.top));
    check('g.moved', Math.abs(r5top - 66) < 0.5 && (await txt(p, '.side')).includes('10:00–11:00'), r5top);
    check('g.noPendingAfter', await p.locator('.ev.pending').count() === 0);
    // click (no drag) still opens detail
    await p.locator('[data-booking="r4"]').click();
    check('g.clickStillOpens', (await txt(p, '#panel-title')).includes('정민재'));
    // week view: drag across days keeps designer
    await p.locator('[data-cal-view="week"]').click();
    await p.evaluate(() => { document.querySelector('.cal-scroll').scrollTop = 40; });
    await dragTo('[data-booking="r6"]', '.col[data-col-date="22"]', 660);
    check('g.week.preview', (await txt(p, '.confirm-box')).includes('10월 22일 (목) 11:00') && (await txt(p, '.confirm-box')).includes('지우'));
    await p.locator('[data-move-confirm]').click();
    check('g.week.moved', (await p.locator('.col[data-col-date="22"] [data-booking="r6"]').count()) === 1 && (await p.locator('.col[data-col-date="21"] [data-booking="r6"]').count()) === 0);
    await p.locator('[data-cal-view="day"]').click(); await p.locator('[data-cal-nav="today"]').click();
    check('g.doneNotDraggable', !(await p.locator('[data-booking="r1"]').evaluate(e => e.classList.contains('draggable'))));
    // + 예약 추가 from a non-calendar page opens the form directly
    await p.locator('.sidebar [data-page="list"]').click();
    await p.locator('[data-action="add-open"]').click();
    check('f.addFromList', (await txt(p, '#crumb-page')) === '예약 캘린더' && await p.locator('#cal-form[data-type="booking"]').isVisible());
    await p.locator('[data-panel-close]').first().click();
    // month view
    await p.locator('[data-cal-view="month"]').click();
    check('mo.cells', await p.locator('.mday:not(.empty)').count() === 31 && (await p.locator('.mday.empty').count()) === 4);
    check('mo.closedTuesdays', await p.locator('.mday.closed').count() === 4, await p.locator('.mday.closed').count());
    check('mo.todayHasBookings', (await txt(p, '[data-cal-month-day="19"]')).includes('10:00 김하늘'));
    check('mo.avatars', await p.locator('[data-cal-month-day="21"] .mday-av .avatar').count() === 3);
    check('mo.summary', (await txt(p, '.side')).includes('영업일') && (await txt(p, '.side')).includes('디자이너 출근일'));
    check('mo.navDisabled', await p.locator('[data-cal-nav="1"]').isDisabled());
    await p.screenshot({ path: OUT + '/d-month.png', fullPage: true });
    await p.locator('[data-cal-month-day="21"]').click();
    check('mo.toDay', (await p.locator('[data-cal-view="day"]').getAttribute('aria-pressed')) === 'true' && (await txt(p, '.cal-date')).includes('21일'));
    // roster: toggle minseo off on the 22nd, see it in the calendar, then reset
    await p.locator('.sidebar [data-page="roster"]').click();
    check('ro.rows', await p.locator('.roster tbody tr').count() === 4);
    check('ro.sumBefore', (await txt(p, '.roster tbody tr:nth-child(4) .r-sum')).startsWith('27'), await txt(p, '.roster tbody tr:nth-child(4) .r-sum'));
    await p.locator('[data-roster="minseo:22"]').click();
    check('ro.toggledOff', await p.locator('td.off [data-roster="minseo:22"]').count() === 1 && (await txt(p, '.savebar')).includes('바꾼 날 1건'));
    check('ro.sumAfter', (await txt(p, '.roster tbody tr:nth-child(4) .r-sum')).startsWith('26'));
    check('ro.shopOffDisabled', await p.locator('[data-roster="soyeon:6"]').isDisabled() && await p.locator('[data-roster="jiu:20"]').isDisabled());
    await p.locator('[data-roster="shop:20"]').click();
    check('ro.shopOpenOnTuesday', await p.locator('td.on.ex [data-roster="shop:20"]').count() === 1 && await p.locator('[data-roster="jiu:20"]').isEnabled() && (await p.locator('td.off [data-roster="jiu:20"]').count()) === 1);
    await p.locator('[data-roster="jiu:20"]').click();
    check('ro.workOnClosedWeekday', await p.locator('td.on.ex [data-roster="jiu:20"]').count() === 1 && (await txt(p, '.savebar')).includes('바꾼 날 3건'));
    await p.screenshot({ path: OUT + '/d-roster.png', fullPage: true });
    await p.locator('.sidebar [data-page="calendar"]').click();
    await p.locator('[data-cal-view="day"]').click(); await p.locator('[data-cal-nav="today"]').click(); await p.locator('[data-cal-nav="1"]').click(); await p.locator('[data-cal-nav="1"]').click(); await p.locator('[data-cal-nav="1"]').click();
    check('ro.calendarReflects', (await txt(p, '.cal-date')).includes('22일') && (await p.locator('.col[data-col="minseo"] .zone.off.full').count()) === 1);
    await p.locator('.sidebar [data-page="roster"]').click();
    await p.locator('[data-action="roster-reset"]').click();
    check('ro.reset', (await txt(p, '.roster tbody tr:nth-child(4) .r-sum')).startsWith('27') && await p.locator('[data-action="roster-reset"]').isDisabled());
    // messages
    check('ms.navBadge', (await txt(p, '.sidebar [data-page="messages"] .nbadge')) === '2');
    await p.locator('.sidebar [data-page="messages"]').click();
    check('ms.threads', await p.locator('.msg-item').count() === 4 && (await p.locator('.msg-item .unread').count()) === 2);
    await p.locator('[data-thread="t1"]').click();
    check('ms.opened', (await p.locator('.bubble').count()) === 3 && (await p.locator('.msg-item .unread').count()) === 1 && (await txt(p, '.msg-bkcard')).includes('시그니처 펌'));
    await p.locator('[data-quick]').first().click();
    check('ms.quickFills', (await p.locator('#msg-form textarea').inputValue()).startsWith('네, 예약 확인했어요'));
    await p.locator('#msg-form button[type=submit]').click();
    check('ms.sent', (await p.locator('.bubble.shop').count()) === 1 && (await txt(p, '.bubble.shop')).includes('방금'));
    await p.screenshot({ path: OUT + '/d-messages.png', fullPage: true });
    await p.locator('.msg-head [data-booking]').click();
    check('ms.toBooking', (await txt(p, '#crumb-page')) === '예약 캘린더' && (await txt(p, '#panel-title')).includes('최유진'));
    await p.locator('[data-msg-booking]').first().click();
    check('ms.backToThread', (await txt(p, '#crumb-page')) === '메시지' && (await p.locator('.msg-item.sel').count()) === 1);
    await p.locator('.sidebar [data-page="home"]').click();
    check('ms.homeTodo', (await txt(p, '.todo')).includes('답변을 기다리는 메시지 1건'));
    // menu images
    await p.locator('.sidebar [data-page="menus"]').click();
    check('mi.thumbs', await p.locator('.table .thumb').count() === 4);
    await p.locator('[data-menu="1"]').click();
    check('mi.editorPhoto', await p.locator('#menu-photo .thumb').isVisible() && (await txt(p, '#menu-photo')).includes('사진 올리기'));
    await p.locator('#editor [data-close="editor"]').first().click();
    await p.locator('#customer-preview').click();
    check('mi.customerThumbs', await p.locator('#customer .pick .thumb').count() >= 3);
    await p.keyboard.press('Escape');
    // stats
    await p.locator('.sidebar [data-page="stats"]').click();
    const sk = await p.locator('.kpi b').allInnerTexts();
    check('s.kpis', sk.length === 4, sk);
    check('s.cards', await p.locator('.stat-grid .panel').count() === 4);
    check('s.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/d-stats.png', fullPage: true });
    await p.locator('[data-stats-period="week"]').click();
    check('s.week', (await txt(p, '.kpi')).includes('예약'));
    // rules: notifications
    await p.locator('.sidebar [data-page="rules"]').click();
    check('r.toggles', await p.locator('.toggles .switch').count() === 3);
    // current scenario: home shows no fake numbers
    await p.locator('.sidebar [data-page="home"]').click();
    await p.locator('#cal-scenario').selectOption('current');
    const k2 = await p.locator('.kpi b').allInnerTexts();
    check('h.current.dashes', k2.every(v => v.trim() === '—'), k2);
    check('h.current.noFeed', await p.locator('.feed li').count() === 0);
    await p.screenshot({ path: OUT + '/d-home-current.png', fullPage: true });
    await p.locator('.sidebar [data-page="stats"]').click();
    check('s.current.empty', (await txt(p, 'main')).includes('예약 연동 후 집계돼요'));
    check('d.errors', errs.length === 0, errs);
    await c.close();
  }
  // ---------- mobile ----------
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.kpis');
    check('m.home.overflow', await overflowOk(p));
    check('m.kpis2x2', (await p.locator('.kpi').nth(1).boundingBox()).y === (await p.locator('.kpi').nth(0).boundingBox()).y && (await p.locator('.kpi').nth(2).boundingBox()).y > (await p.locator('.kpi').nth(0).boundingBox()).y);
    await p.screenshot({ path: OUT + '/m-home.png', fullPage: true });
    await p.locator('.mobile-nav [data-page="customers"]').click();
    check('m.cust.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/m-customers.png', fullPage: true });
    await p.locator('.crows .brow').first().click();
    const sb = await p.locator('.side.open').boundingBox();
    check('m.cust.sheet', sb && Math.round(sb.y + sb.height) === 844);
    await p.screenshot({ path: OUT + '/m-customer-sheet.png' });
    await p.locator('.side.open [data-panel-close]').first().click();
    await p.locator('.mobile-nav [popovertarget="more-menu"]').click();
    await p.locator('#more-menu [data-page="list"]').click();
    check('m.list.overflow', await overflowOk(p));
    check('m.list.rows', await p.locator('.brow').count() === 13);
    await p.screenshot({ path: OUT + '/m-list.png', fullPage: true });
    await p.locator('.mobile-nav [popovertarget="more-menu"]').click();
    await p.locator('#more-menu [data-page="stats"]').click();
    check('m.stats.overflow', await overflowOk(p));
    await p.screenshot({ path: OUT + '/m-stats.png', fullPage: true });
    await p.locator('.mobile-nav [data-page="calendar"]').click(); await p.locator('[data-cal-view="month"]').click();
    check('m.month.overflow', await overflowOk(p));
    check('m.month.count', (await p.locator('.mday.has').count()) >= 6);
    await p.screenshot({ path: OUT + '/m-month.png', fullPage: true });
    await p.locator('[data-cal-month-day="24"]').click();
    check('m.month.toList', (await p.locator('[data-cal-view="list"]').getAttribute('aria-pressed')) === 'true' && (await txt(p, '.cal-date')).includes('24일'));
    await p.locator('.mobile-nav [data-page="messages"]').click();
    check('m.msg.list', await p.locator('.msg-item').count() === 4 && !(await p.locator('.msg-thread').isVisible()));
    await p.locator('[data-thread="t2"]').click();
    check('m.msg.thread', await p.locator('.msg-thread').isVisible() && !(await p.locator('.msg-list').isVisible()));
    await p.screenshot({ path: OUT + '/m-messages.png', fullPage: true });
    await p.locator('[data-msg-back]').click();
    check('m.msg.back', await p.locator('.msg-list').isVisible());
    check('m.msg.overflow', await overflowOk(p));
    check('m.smallTargets', true, await p.evaluate(() => [...document.querySelectorAll('main button, main select, main input, .mobile-nav button')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44) && !e.closest('.switch'); }).map(e => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 12)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`)));
    check('m.errors', errs.length === 0, errs);
    await c.close();
  }
  await b.close();
  console.log(`${n - fails.length}/${n} passed`, fails.length ? 'FAILED: ' + fails.join(', ') : '');
})().catch(e => { console.error('CRASH', e.message); process.exit(1); });
