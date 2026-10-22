// Route track geometry against the live stylesheet: build the new rail markup
// for 16/39/48/60 stops at 320px and 390px phones and assert no overflow, both
// ends inside the track, and every drawn dot centred where focusStopAt's
// rounded-ratio mapping expects it (same rule as lib/subway-track.ts).
const { chromium } = require('playwright');
const density = (n, w) => n <= 1 ? '0' : !(w > 0) ? (n > 48 ? '2' : n > 22 ? '1' : '0') : (w / (n - 1)) < 7 ? '2' : (w / (n - 1)) < 12 ? '1' : '0';
let pass = 0, fail = 0; const fails = []; const check = (n, ok, info = '') => { ok ? pass++ : (fail++, fails.push(n + ' — ' + info)); console.log((ok ? 'ok   ' : 'FAIL ') + n + (info ? ' — ' + String(info).slice(0, 200) : '')); };
(async () => {
  const b = await chromium.launch();
  for (const width of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width, height: 844 }, isMobile: true })).newPage(); p.setDefaultNavigationTimeout(180000);
    await p.goto((process.env.QA_IMPL_URL || 'http://127.0.0.1:3113') + '/settings/language', { waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 3000));
    for (const stops of [16, 39, 48, 60]) {
      const r = await p.evaluate(({ stops, density }) => {
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:' + (document.documentElement.clientWidth - 32) + 'px;padding:0 12px;box-sizing:border-box;background:#fff';
        const track = document.createElement('div'); track.className = 'subway-ticket-track';
        const rail = document.createElement('div'); rail.className = 'subway-track-rail'; track.appendChild(rail); host.appendChild(track); document.body.appendChild(host);
        const dens = new Function('return ' + density)(); const railW = rail.getBoundingClientRect().width; track.dataset.density = dens(stops, railW);
        const last = stops - 1; const transfers = new Set([12, 25, 33, 47].filter(i => i < last));
        for (let i = 0; i < stops; i++) {
          if (i > 0) { const leg = document.createElement('i'); leg.className = 'subway-track-leg'; leg.style.background = '#888'; leg.style.left = ((i - 1) / last * 100) + '%'; leg.style.width = (1 / last * 100) + '%'; rail.appendChild(leg); }
          const s = document.createElement('span'); s.className = 'subway-track-stop' + (i === 0 || i === last ? ' end' : '') + (transfers.has(i) ? ' transfer' : '') + (i === Math.floor(stops * 0.8) ? ' active' : ''); s.style.setProperty('--stop-color', '#5a7'); s.style.left = (i / last * 100) + '%'; rail.appendChild(s);
        }
        const tr = track.getBoundingClientRect(), rr = rail.getBoundingClientRect(); const dots = [...rail.querySelectorAll('.subway-track-stop')];
        let misaligned = 0, outside = 0;
        dots.forEach((d, i) => { const db = d.getBoundingClientRect(); const cx = db.left + db.width / 2; const expected = rr.left + (i / last) * rr.width; if (Math.abs(cx - expected) > 0.6) misaligned++; if (db.left < tr.left - 0.01 || db.right > tr.right + 0.01) outside++; if (Math.round(((cx - rr.left) / rr.width) * last) !== i) misaligned++; });
        const out = { density: track.dataset.density, railW: Math.round(railW), scrollW: track.scrollWidth, clientW: track.clientWidth, overflow: track.scrollWidth > track.clientWidth, misaligned, outside, firstLeft: Math.round(dots[0].getBoundingClientRect().left - tr.left), lastRightGap: Math.round(tr.right - dots[last].getBoundingClientRect().right), legs: rail.querySelectorAll('.subway-track-leg').length, height: Math.round(tr.height) };
        host.remove(); return out;
      }, { stops, density: density.toString() }).catch(e => ({ error: e.message }));
      // density function is passed as source; re-evaluate inside the page
      const info = JSON.stringify(r);
      check(`${width}px · ${stops} stops · density ${r.density}`, !r.error && !r.overflow && r.misaligned === 0 && r.outside === 0 && r.firstLeft >= 0 && r.lastRightGap >= 0 && r.legs === stops - 1 && r.height >= 44, info);
    }
    await p.context().close();
  }
  await b.close(); console.log(`\n${pass}/${pass + fail} passed` + (fail ? '\nFAILED:\n- ' + fails.join('\n- ') : ''));
})().catch(e => { console.error('CRASH', e.stack?.split('\n').slice(0, 3).join(' | ')); process.exit(1); });
