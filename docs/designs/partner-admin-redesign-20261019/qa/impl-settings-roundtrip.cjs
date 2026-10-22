// 관리자 '저장'·'되돌리기' 버튼 실제 왕복 점검 (2026-10-21): 값을 바꿔 저장 → 새로고침 후 반영 확인 → 원래 값으로 되돌려 저장 → 다시 확인.
// 대상: 예약 설정(최소 사전 예약 시간), 매장 정보(임시 안내·영어 응대 스위치·되돌리기), 메뉴 편집 창(한국어 설명), 기본 근무시간(월요일 종료 시간).
// 로컬 QA 매장만 바꾸고 끝나면 원래 값으로 돌려놓는다(되돌리기에 실패하면 FAIL 과 함께 원래 값을 출력한다). 운영 주소에는 쓰지 않는다.
// 실행: NODE_PATH=$PWD/node_modules [QA_IMPL_URL=http://127.0.0.1:3114] node docs/designs/partner-admin-redesign-20261019/qa/impl-settings-roundtrip.cjs
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const lib = require('./layout-audit-lib.cjs'); const { sleep, settle } = lib;
const ORIGIN = (process.env.QA_IMPL_URL || 'http://127.0.0.1:3113').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(ORIGIN)) throw new Error('local QA only');
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
let pass = 0, fail = 0; const fails = []; const originals = {};
const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(`${n} — ${info}`)); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${info ? ' — ' + String(info).slice(0, 200) : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' }); await lib.hideDevBadge(ctx);
  const p = await ctx.newPage(); p.setDefaultTimeout(60000); p.setDefaultNavigationTimeout(180000);
  const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const confirms = []; p.on('dialog', d => { confirms.push(d.message()); d.accept(); }); // '변경사항 버리고 다시 불러오기'는 브라우저 확인창을 띄운다
  const isWrite = r => !/^(GET|HEAD|OPTIONS)$/.test(r.request().method()) && /\/api\/partner(\/|\?|$)|\/rest\/v1\/|\/functions\/v1\//.test(r.url()) && !/\/auth\/v1\//.test(r.url());
  const writes = []; p.on('response', r => { if (isWrite(r)) writes.push({ m: r.request().method(), s: r.status(), u: r.url().replace(ORIGIN, '').replace(/^https?:\/\/127\.0\.0\.1:\d+/, '').replace(/\?.*$/, '').slice(0, 80) }); });
  const open = async route => { await p.goto(ORIGIN + route, { waitUntil: 'domcontentloaded' }); await settle(p, 60000); await sleep(800); };
  const saveVia = async (button, label) => {
    const w0 = writes.length; check(`${label}.saveEnabled`, await button.isEnabled());
    await Promise.all([p.waitForResponse(isWrite, { timeout: 60000 }).catch(() => null), button.click()]);
    await sleep(1500); const w = writes.slice(w0); check(`${label}.saved`, w.length > 0 && w.every(x => x.s < 300), JSON.stringify(w)); return w;
  };
  try {
    await lib.login(p, ORIGIN, access.partner, '/partner/rules'); await settle(p, 60000);

    // 1) 예약 설정: 최소 사전 예약 시간
    const lead = () => p.getByLabel(/최소 사전 예약 시간/).first();
    const save = () => p.getByRole('button', { name: '변경사항 저장', exact: true }).first();
    const discard = () => p.getByRole('button', { name: '변경사항 버리고 다시 불러오기', exact: true }).first();
    originals.lead = await lead().inputValue(); const changed = String(Number(originals.lead || 60) + 30);
    check('rules.saveDisabledAtRest', !(await save().isEnabled()));
    await lead().fill('75'); await sleep(400); const w0 = writes.length; await discard().click();
    for (let i = 0; i < 40 && (await lead().inputValue()) !== originals.lead; i++) await sleep(250);
    check('rules.discardRestores', (await lead().inputValue()) === originals.lead && writes.length === w0, `value=${await lead().inputValue()} confirm=«${confirms.slice(-1)[0] || ''}»`);
    await lead().fill(changed); await sleep(400); await saveVia(save(), 'rules.change');
    await open('/partner/rules'); check('rules.persisted', (await lead().inputValue()) === changed, `after reload=${await lead().inputValue()}`);
    await lead().fill(originals.lead); await sleep(400); await saveVia(save(), 'rules.revert');
    await open('/partner/rules'); check('rules.reverted', (await lead().inputValue()) === originals.lead, `after reload=${await lead().inputValue()}`);

    // 2) 매장 정보: 임시 안내 + 영어 응대 스위치, 되돌리기
    await open('/partner/settings');
    const notice = () => p.getByLabel(/임시 안내/).first(); const english = () => p.getByLabel('영어 응대 가능').first();
    const storeSave = () => p.getByRole('button', { name: '저장', exact: true }).first(); const undo = () => p.getByRole('button', { name: '되돌리기', exact: true }).first();
    originals.notice = await notice().inputValue(); originals.english = await english().isChecked();
    await notice().fill('되돌리기 확인용'); await sleep(300); await undo().click();
    for (let i = 0; i < 40 && (await notice().inputValue()) !== originals.notice; i++) await sleep(250);
    check('settings.undoRestores', (await notice().inputValue()) === originals.notice, `value=${await notice().inputValue()}`);
    const text = 'QA 점검: 오늘은 17시까지 접수합니다.';
    await notice().fill(text); await english().setChecked(!originals.english, { force: true }); await sleep(400); await saveVia(storeSave(), 'settings.change');
    await open('/partner/settings'); check('settings.persisted', (await notice().inputValue()) === text && (await english().isChecked()) === !originals.english, `notice=${await notice().inputValue()} english=${await english().isChecked()}`);
    await notice().fill(originals.notice); await english().setChecked(originals.english, { force: true }); await sleep(400); await saveVia(storeSave(), 'settings.revert');
    await open('/partner/settings'); check('settings.reverted', (await notice().inputValue()) === originals.notice && (await english().isChecked()) === originals.english, `notice=${await notice().inputValue()} english=${await english().isChecked()}`);

    // 3) 메뉴 편집 창: 한국어 설명
    const editMenu = async () => { await open('/partner/services'); await p.locator('main button, main a').filter({ hasText: /^\s*편집\s*$/ }).first().click(); await sleep(1500); const d = p.locator('.live-modal, dialog[open], [role="dialog"]').last(); await d.getByLabel('메뉴 설명 (한국어)').waitFor({ timeout: 60000 }); return d; };
    let m = await editMenu(); const desc = () => m.getByLabel('메뉴 설명 (한국어)');
    originals.menuDesc = await desc().inputValue();
    await desc().fill(originals.menuDesc + ' (QA 점검)'); await sleep(300); await saveVia(m.getByRole('button', { name: '변경사항 저장', exact: true }), 'menu.change');
    m = await editMenu(); check('menu.persisted', (await desc().inputValue()) === originals.menuDesc + ' (QA 점검)', await desc().inputValue());
    await desc().fill(originals.menuDesc); await sleep(300); await saveVia(m.getByRole('button', { name: '변경사항 저장', exact: true }), 'menu.revert');
    m = await editMenu(); check('menu.reverted', (await desc().inputValue()) === originals.menuDesc, await desc().inputValue());
    const closeBtn = m.getByRole('button', { name: /닫기/ }).first(); await closeBtn.click(); await sleep(800); check('menu.dialogCloses', (await p.locator('.live-modal, dialog[open], [role="dialog"]').count()) === 0);

    // 4) 기본 근무시간: 월요일 종료 시간
    const monday = async () => { await open('/partner/availability'); await p.getByRole('button', { name: '월요일 시간 편집' }).first().click(); await sleep(1200); };
    await monday(); const end = () => p.getByLabel('종료 시간').first();
    originals.mondayEnd = await end().inputValue(); const newEnd = originals.mondayEnd === '19:30' ? '19:00' : '19:30';
    await end().fill(newEnd); await end().blur(); await sleep(400); await saveVia(p.getByRole('button', { name: '변경사항 저장', exact: true }).first(), 'hours.change');
    await monday(); check('hours.persisted', (await end().inputValue()) === newEnd, await end().inputValue());
    await end().fill(originals.mondayEnd); await end().blur(); await sleep(400); await saveVia(p.getByRole('button', { name: '변경사항 저장', exact: true }).first(), 'hours.revert');
    await monday(); check('hours.reverted', (await end().inputValue()) === originals.mondayEnd, await end().inputValue());
    check('errors.none', errs.length === 0, errs.join(' | '));
  } catch (e) { check('crash', false, e.message.split('\n').slice(0, 4).join(' | ')); }
  console.log('original values (restore manually if a revert failed):', JSON.stringify(originals));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
  process.exit(fail ? 1 : 0);
})();
