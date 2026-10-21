// 2026-10-21 리뷰 수정 확인: (1) 라이트박스 사진이 가로 폰·노트북 창에서도 잘리지 않고 틀 안에 맞춰지는지(lightbox-1)
// (2) 긴 역 이름이 노선 티켓을 시트 밖으로 넓히지 않는지(track-1, 실제 스타일시트에 합성 DOM).
const { chromium } = require('playwright'); const fs = require('fs'), os = require('os'), path = require('path');
const ORIGIN = process.env.QA_IMPL_URL || 'http://127.0.0.1:3113';
const OUT = process.env.QA_OUT || path.join(os.tmpdir(), 'partner-admin-qa', 'impl'); fs.mkdirSync(OUT, { recursive: true });
const PLACE = process.env.PLACE || 'ados-63-skypicnic';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const fails = []; const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 220) : '')); };
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 844, height: 390, mobile: true, name: 'phone-landscape' }, { width: 1280, height: 720, mobile: false, name: 'laptop' }, { width: 390, height: 844, mobile: true, name: 'phone-portrait' }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, locale: 'en-US' });
    const p = await ctx.newPage(); p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000);
    await p.goto(`${ORIGIN}/place/${PLACE}`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('.place-photo-tile', { timeout: 150000 }); await sleep(2500);
    await p.locator('.place-photo-tile').first().click(); await p.waitForSelector('.photo-lightbox img'); await sleep(1500);
    const m = await p.evaluate(() => {
      const track = document.querySelector('.photo-lightbox-track').getBoundingClientRect();
      const img = [...document.querySelectorAll('.photo-lightbox-track img')][0]; const r = img.getBoundingClientRect();
      return { trackH: Math.round(track.height), trackW: Math.round(track.width), imgH: Math.round(r.height), imgW: Math.round(r.width), imgTop: Math.round(r.top - track.top), imgBottomGap: Math.round(track.bottom - r.bottom), natural: `${img.naturalWidth}x${img.naturalHeight}` };
    });
    check(`lightbox.fits.${vp.name}`, m.imgH <= m.trackH + 1 && m.imgW <= m.trackW + 1 && m.imgTop >= -1 && m.imgBottomGap >= -1, JSON.stringify(m));
    await p.screenshot({ path: path.join(OUT, `fit-${vp.name}.png`) });
    await ctx.close();
  }
  // route ticket with long endpoint names (synthetic markup, real stylesheet)
  for (const width of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width, height: 844 }, isMobile: true })).newPage(); p.setDefaultNavigationTimeout(180000);
    await p.goto(ORIGIN + '/settings/language', { waitUntil: 'domcontentloaded' }); await sleep(3000);
    const r = await p.evaluate(() => {
      const host = document.createElement('div'); host.className = 'subway-controller'; host.style.cssText = `position:fixed;left:0;top:0;width:${document.documentElement.clientWidth}px;background:#fff`;
      const summary = document.createElement('div'); summary.className = 'subway-route-summary';
      const ends = document.createElement('div'); ends.className = 'subway-ticket-ends';
      for (const name of ["Incheon Int'l Airport Terminal 1", 'Dongdaemun History & Culture Park']) { const n = document.createElement('b'); n.textContent = name; ends.appendChild(n); }
      const track = document.createElement('div'); track.className = 'subway-ticket-track'; const rail = document.createElement('div'); rail.className = 'subway-track-rail'; track.appendChild(rail);
      const meta = document.createElement('div'); meta.className = 'subway-ticket-meta'; meta.textContent = 'Open in Google Maps · Nearby · Edit ×';
      summary.append(ends, track, meta); host.appendChild(summary); document.body.appendChild(host);
      const hs = host.getBoundingClientRect(), ss = summary.getBoundingClientRect(), tr = track.getBoundingClientRect();
      const out = { hostW: Math.round(hs.width), summaryW: Math.round(ss.width), summaryScroll: summary.scrollWidth, summaryClient: summary.clientWidth, trackRight: Math.round(tr.right), hostRight: Math.round(hs.right), endsOverflowHidden: [...ends.children].every(b => b.scrollWidth >= b.clientWidth) };
      host.remove(); return out;
    });
    check(`ticket.longNames.${width}px`, r.summaryW <= r.hostW && r.trackRight <= r.hostRight && r.summaryScroll <= r.summaryClient + 1, JSON.stringify(r));
    await p.context().close();
  }
  await b.close(); console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
})().catch(e => { console.error('CRASH', e.message.split('\n').slice(0, 8).join(' | ')); process.exit(1); });
