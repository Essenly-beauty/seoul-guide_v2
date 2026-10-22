// Partner photo-header switch → map sheet detail (the path the codex review
// found unwired), plus the legacy 4-key PATCH through the real API.
// The local test account file is read at runtime; its values are never printed.
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const ORIGIN = process.env.QA_IMPL_URL || 'http://127.0.0.1:3113'; const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true }); const SHOP = 'myseouldrop-booking-studio';
const access = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'myseouldrop-booking-local-access.json'), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = []; const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 220) : '')); };
const instant = p => ({ contactPhone: p.contactPhone, contactEmail: p.contactEmail, englishOk: p.englishOk, notice: p.notice });
(async () => {
  const b = await chromium.launch();
  // partner session
  const pc = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' }); const a = await pc.newPage(); a.setDefaultNavigationTimeout(180000); a.setDefaultTimeout(90000);
  await a.goto(ORIGIN + '/login?next=/partner/settings', { waitUntil: 'domcontentloaded' }); await a.waitForSelector('#signin-email'); await sleep(2000);
  await a.fill('#signin-email', access.partner.email); await a.fill('#signin-password', access.partner.password);
  await Promise.all([a.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }).catch(() => {}), a.click('button[type="submit"]')]); await a.waitForSelector('main');
  const api = pc.request; const H = { 'Content-Type': 'application/json', Origin: ORIGIN };
  const get = async () => (await api.get(ORIGIN + '/api/partner/operations/profile')).json();
  const patch = async (values, expectedUpdatedAt) => { const r = await api.patch(ORIGIN + '/api/partner/operations/profile', { headers: H, data: { action: 'update', expectedUpdatedAt, values } }); return { status: r.status(), body: await r.json() }; };
  const pub = async () => (await (await api.get(ORIGIN + '/api/places/' + SHOP + '/profile')).json()).profile;
  let snap = await get(); check('partner.snapshot', !!snap.profile && typeof snap.profile.showPhotos === 'boolean', `showPhotos=${snap.profile && snap.profile.showPhotos}`);
  // legacy 4-key request keeps the stored switch
  const before = snap.profile.showPhotos;
  let r = await patch(instant(snap.profile), snap.profile.updatedAt); check('api.legacy4key.ok', r.status === 200 && r.body.profile && r.body.profile.showPhotos === before, `status=${r.status} showPhotos=${r.body.profile && r.body.profile.showPhotos} code=${r.body.code || ''}`);
  // off
  r = await patch({ ...instant(snap.profile), showPhotos: false }, r.body.profile.updatedAt); check('api.off', r.status === 200 && r.body.profile.showPhotos === false, `status=${r.status} code=${r.body.code || ''}`);
  check('public.off', (await pub()).showPhotos === false);
  const mapDetail = async (tag) => {
    const gc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'en-US' }); const g = await gc.newPage(); g.setDefaultNavigationTimeout(180000); g.setDefaultTimeout(90000);
    await g.goto(ORIGIN + '/map?place=' + SHOP, { waitUntil: 'domcontentloaded' }); await g.waitForSelector('.mapsheet', { timeout: 150000 }); await sleep(5000);
    const handle = g.getByRole('button', { name: /Press to fully expand/ }).first(); if (await handle.count()) { await handle.click(); await sleep(2500); }
    const info = await g.evaluate(() => ({ detail: document.querySelectorAll('.mapsheet-detail-body .detail-scroll').length, chrome: document.querySelectorAll('.mapsheet .place-hero-chrome').length, photoArea: document.querySelectorAll('.mapsheet .place-photo-collage, .mapsheet .place-photo-empty').length, title: (document.querySelector('.mapsheet-detail-body .place-detail-intro')?.textContent || '').replace(/\s+/g, ' ').slice(0, 120) }));
    await g.screenshot({ path: path.join(OUT, `map-detail-${tag}.png`) }); await gc.close(); return info;
  };
  const off = await mapDetail('photos-off');
  check('map.detail.off.open', off.detail === 1, JSON.stringify(off));
  check('map.detail.off.noPhotoArea', off.chrome === 1 && off.photoArea === 0, JSON.stringify(off));
  const profileName = (snap.profile.nameEn || '').trim() || snap.profile.nameKo;
  check('map.detail.off.profileName', off.title.includes(profileName), `title="${off.title}"`);
  // back on
  r = await patch({ ...instant(snap.profile), showPhotos: true }, r.body.profile.updatedAt); check('api.on', r.status === 200 && r.body.profile.showPhotos === true, `status=${r.status} code=${r.body.code || ''}`);
  check('public.on', (await pub()).showPhotos === true);
  const on = await mapDetail('photos-on');
  check('map.detail.on.photoArea', on.detail === 1 && on.photoArea === 1 && on.chrome === 0, JSON.stringify(on));
  await b.close(); console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 12).join(' | ')); process.exit(1); });
