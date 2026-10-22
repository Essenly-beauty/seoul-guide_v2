// 화면 문장·레이아웃·버튼 점검 공용 도구 (2026-10-21).
// auditInPage 는 브라우저 안에서 실행되어 "눈으로 보이는" 문제를 수치로 찾는다:
//   pageOverflow   문서가 가로로 넘침
//   clipped        overflow:hidden/clip 상자가 글자·버튼을 잘라 먹음 (ellipsis·line-clamp 는 따로 표시)
//   spills         글자가 자기 상자 밖으로 삐져나감
//   offscreen      화면 가장자리에서 반쯤 잘린 요소 (가로 스크롤 영역 안은 제외)
//   controlWraps   버튼·탭·칩·배지처럼 한 줄이어야 할 이름이 두 줄 이상
//   wordBreaks     한 단어(어절) 안에서 줄이 바뀜 — forced=true 는 단어가 줄보다 길어 어쩔 수 없는 경우
//   orphans        마지막 줄에 1~2글자만 남음
//   overlaps       글자끼리 겹침 (고정 바와 스크롤 내용의 겹침은 제외)
//   selectClipped / placeholderClipped  선택 상자·입력칸 안내 문구가 잘림
//   smallTargets   휴대폰에서 40px 미만 터치 영역
// hitTestInPage 는 각 버튼을 화면 가운데로 스크롤한 뒤 가운데를 실제로 누를 수 있는지(다른 요소가 덮지 않는지) 본다.
// bottomClearanceInPage 는 끝까지 스크롤해도 하단 고정 바 밑에 숨어 있는 내용을 찾는다.
const fs = require('fs'), path = require('path');

function loadTranslations(root) {
  const order = ['en', 'ja', 'zh-CN', 'es', 'fr']; const map = {};
  const lit = `(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`;
  const row = new RegExp(`\\[\\s*${Array(5).fill(lit).join('\\s*,\\s*')}\\s*,?\\s*\\]`, 'g');
  const dir = path.join(root, 'lib/i18n');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8'); let m;
    while ((m = row.exec(src))) {
      const vals = []; for (let i = 0; i < 5; i++) vals.push((m[1 + i * 2] ?? m[2 + i * 2] ?? '').replace(/\\(.)/g, '$1'));
      if (!map[vals[0]]) map[vals[0]] = Object.fromEntries(order.map((l, i) => [l, vals[i]]));
    }
  }
  return locale => en => (map[en] && map[en][locale]) || en;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const BUSY = /불러오고 있습니다|확인하고 있습니다|조회하고 있어요|조회 중|Loading|Checking|読み込み中|確認中|正在|Cargando|Comprobando|Chargement|Vérification/;
async function settle(page, ms = 30000) {
  await page.waitForSelector('main, [role="main"], body', { timeout: 60000 }).catch(() => {});
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await page.locator('body').innerText().catch(() => '');
    const skeleton = await page.locator('[aria-busy="true"]:visible').count().catch(() => 0);
    if (t.length > 60 && !BUSY.test(t) && !skeleton) break;
    await sleep(500);
  }
  await sleep(700);
}

// 하이드레이션 전에 제출하면 브라우저 기본 GET 제출로 자격 증명이 주소에 붙는다 → React가 폼에 붙을 때까지 기다리고, 실패하면 한 번 더 시도한다.
async function login(page, origin, account, next) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await page.goto(origin + '/login?next=' + encodeURIComponent(next), { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#signin-email', { timeout: 90000 }); }
    catch (e) { if (attempt === 1) throw e; await sleep(5000); continue; } // 개발 서버가 다시 컴파일하는 동안에는 첫 요청이 늦거나 404가 날 수 있다
    await page.waitForFunction(() => { const f = document.querySelector('#signin-email') && document.querySelector('#signin-email').form; return !!f && Object.keys(f).some(k => k.startsWith('__reactProps')); }, null, { timeout: 90000 }).catch(() => {});
    await sleep(500);
    await page.fill('#signin-email', account.email); await page.fill('#signin-password', account.password);
    await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 90000 }).catch(() => {}), page.click('button[type="submit"]')]);
    if (!new URL(page.url()).pathname.startsWith('/login')) return;
  }
  throw new Error('login did not leave /login');
}

// Next.js 개발 배지(N)는 제품 화면이 아니므로 가린다.
const hideDevBadge = ctx => ctx.addInitScript(() => {
  const add = () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.documentElement.appendChild(st); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
});

function auditInPage(opts) {
  const mobile = !!opts.mobile; const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
  const out = { vw, vh, pageOverflow: null, clipped: [], spills: [], offscreen: [], controlWraps: [], wordBreaks: [], orphans: [], overlaps: [], selectClipped: [], placeholderClipped: [], smallTargets: [] };
  const root = (opts.scope && document.querySelector(opts.scope)) || document.body;
  const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/; const HANGUL = /[가-힯]/;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'OPTION', 'TEXTAREA', 'TITLE']);
  const styles = new Map(); const cs = el => { let s = styles.get(el); if (!s) { s = getComputedStyle(el); styles.set(el, s); } return s; };
  const shownCache = new Map();
  const shown = el => {
    if (!el || el.nodeType !== 1) return false; if (shownCache.has(el)) return shownCache.get(el);
    let ok = typeof el.checkVisibility !== 'function' || el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true });
    if (ok) for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = cs(e); if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || parseFloat(s.opacity) === 0) { ok = false; break; } if (e.parentElement && e.parentElement.tagName === 'DETAILS' && !e.parentElement.open && e.tagName !== 'SUMMARY') { ok = false; break; } }
    if (ok) { const r = el.getBoundingClientRect(); ok = r.width > 2 && r.height > 2; }
    shownCache.set(el, ok); return ok;
  };
  const directText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
  const label = el => ((el.getAttribute && el.getAttribute('aria-label')) || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const pathOf = el => { const parts = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 4; e = e.parentElement, i++) { let s = e.tagName.toLowerCase(); const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter(Boolean).slice(0, 2) : []; if (cls.length) s += '.' + cls.join('.'); if (i === 0 && e.getAttribute('aria-label')) s += `[aria-label="${e.getAttribute('aria-label').slice(0, 30)}"]`; parts.unshift(s); } return parts.join(' > '); };
  const lineTops = rects => { const tops = []; for (const r of rects) if (r.width > 0.5 && r.height > 0.5 && !tops.some(t => Math.abs(t - r.top) < Math.max(3, r.height * 0.5))) tops.push(r.top); return tops; };
  const fixedAncestor = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = cs(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const blockOf = el => { let e = el; while (e && /^(inline|contents)$/.test(cs(e).display)) e = e.parentElement; return e || el; };
  const els = [...root.querySelectorAll('*')].filter(el => !(el instanceof SVGElement) && !SKIP.has(el.tagName));

  const se = document.scrollingElement || document.documentElement;
  if (se.scrollWidth > se.clientWidth + 1) {
    const culprits = [];
    for (const el of document.body.querySelectorAll('*')) { if (el instanceof SVGElement) continue; const r = el.getBoundingClientRect(); if (r.right > se.clientWidth + 1 && shown(el)) { culprits.push(`${pathOf(el)} «${label(el).slice(0, 30)}» right=${Math.round(r.right)}`); if (culprits.length >= 6) break; } }
    out.pageOverflow = { scrollWidth: se.scrollWidth, clientWidth: se.clientWidth, culprits };
  }

  for (const el of els) {
    if (!shown(el)) continue; const s = cs(el); const r = el.getBoundingClientRect(); const text = label(el); if (!text) continue;
    if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 2) {
      const cut = [];
      for (const k of el.querySelectorAll('*')) { if (k instanceof SVGElement || !directText(k)) continue; const kr = k.getBoundingClientRect(); if (kr.width < 1) continue; if ((kr.right > r.right + 1 || kr.left < r.left - 1) && shown(k)) cut.push(label(k).slice(0, 40)); if (cut.length >= 6) break; }
      if (directText(el) && !cut.length) cut.push(text.slice(0, 40));
      out.clipped.push({ kind: s.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipX', text: text.slice(0, 70), cut: [...new Set(cut)], sw: el.scrollWidth, cw: el.clientWidth, path: pathOf(el) });
    }
    if ((s.overflowY === 'hidden' || s.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2 && s.position !== 'fixed') {
      const clamp = s.webkitLineClamp && s.webkitLineClamp !== 'none';
      out.clipped.push({ kind: clamp ? 'lineClamp' : 'clipY', text: text.slice(0, 70), sh: el.scrollHeight, ch: el.clientHeight, path: pathOf(el) });
    }
  }

  for (const el of els) {
    if (!directText(el) || !shown(el)) continue; const s = cs(el); if (/^(inline|contents)$/.test(s.display)) continue;
    const r = el.getBoundingClientRect(); const left = r.left + (parseFloat(s.borderLeftWidth) || 0), right = r.right - (parseFloat(s.borderRightWidth) || 0);
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n);
      const bad = [...rg.getClientRects()].find(tr => tr.width >= 1 && !(tr.width < 5 && tr.left >= right - 0.5) && (tr.right > right + 1.5 || tr.left < left - 1.5)); // 줄 끝에 걸친 보존 공백(pre-wrap)은 보이지 않으므로 제외
      if (bad) { out.spills.push({ text: n.nodeValue.trim().slice(0, 60), over: Math.round(Math.max(bad.right - right, left - bad.left)), width: Math.round(r.width), clipped: s.overflowX !== 'visible', path: pathOf(el) }); break; }
    }
  }

  for (const el of els) {
    if (!directText(el) && !el.matches('button, a[href], input, select, [role="button"], [role="tab"]')) continue;
    if (!shown(el)) continue; const r = el.getBoundingClientRect();
    const partRight = r.left < vw - 1 && r.right > vw + 1, partLeft = r.right > 1 && r.left < -1; if (!partRight && !partLeft) continue;
    let inScroller = false, clippedBy = null;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const s = cs(a); if (/(auto|scroll)/.test(s.overflowX)) { inScroller = true; break; } if (/(hidden|clip)/.test(s.overflowX)) { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1 && ar.left >= -1) { clippedBy = a; break; } } }
    if (inScroller || clippedBy) continue;
    out.offscreen.push({ text: label(el).slice(0, 50), left: Math.round(r.left), right: Math.round(r.right), path: pathOf(el) });
  }

  const controls = [...root.querySelectorAll('button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary, label, th, .chip, .status, .badge, [class*="badge"], [class*="chip"], [class*="pill"], [class*="tag"]')].filter(shown);
  for (const el of controls) {
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (!t || t.length > 40) continue;
    const composite = [...el.querySelectorAll('*')].some(k => !(k instanceof SVGElement) && k.tagName !== 'IMG' && /^(block|flex|grid|list-item|table|flow-root)$/.test(cs(k).display) && (k.innerText || '').trim());
    if (composite) continue;
    const textRects = []; const wc = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (wc.nextNode()) { const n = wc.currentNode; if (!n.nodeValue.trim() || !shown(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); textRects.push(...rg.getClientRects()); }
    const tops = lineTops(textRects);
    if (tops.length > 1) out.controlWraps.push({ text: t, lines: tops.length, width: Math.round(el.getBoundingClientRect().width), path: pathOf(el) });
  }

  const seen = new Set(); const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) {
    const n = tw.currentNode, v = n.nodeValue; if (!v || !v.trim()) continue; const el = n.parentElement; if (!el || SKIP.has(el.tagName) || !shown(el)) continue;
    const re = /\S+/g; let m;
    while ((m = re.exec(v))) {
      const w = m[0]; if (w.length < 2 || (CJK.test(w) && !HANGUL.test(w))) continue;
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + w.length);
      const rects = [...rg.getClientRects()].filter(x => x.width > 0.5); if (lineTops(rects).length < 2) continue;
      let at = -1, prevTop = null;
      for (let i = 0; i < w.length; i++) { const c = document.createRange(); c.setStart(n, m.index + i); c.setEnd(n, m.index + i + 1); const cr = [...c.getClientRects()].find(x => x.width > 0); if (!cr) continue; if (prevTop !== null && Math.abs(cr.top - prevTop) > cr.height * 0.5) { at = i; break; } prevTop = cr.top; }
      if (at > 0 && /[-–—/·,.:;)\]}|+&]/.test(w[at - 1])) continue;
      const block = blockOf(el); const bs = cs(block); const avail = block.clientWidth - (parseFloat(bs.paddingLeft) || 0) - (parseFloat(bs.paddingRight) || 0);
      const wordW = rects.reduce((a, x) => a + x.width, 0); const key = pathOf(block) + '|' + w; if (seen.has(key)) continue; seen.add(key);
      out.wordBreaks.push({ word: w, splitAt: at, forced: wordW > avail - 1, context: v.replace(/\s+/g, ' ').trim().slice(0, 90), wordWidth: Math.round(wordW), avail: Math.round(avail), path: pathOf(block) });
    }
  }

  for (const el of els) {
    if (!directText(el) || !shown(el)) continue; const s = cs(el); if (/^(inline|contents)$/.test(s.display)) continue;
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length < 8) continue;
    if (CJK.test(t) && !HANGUL.test(t)) { // 띄어쓰기가 없는 일본어·중국어: 글자 단위로 마지막 줄을 본다
      if (t.length > 160) continue; const chars = []; const w3 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (w3.nextNode()) { const n = w3.currentNode; if (blockOf(n.parentElement) !== el || !shown(n.parentElement)) continue; for (let i = 0; i < n.nodeValue.length; i++) { const ch = n.nodeValue[i]; if (/\s/.test(ch)) continue; const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const r = [...rg.getClientRects()].find(x => x.width > 0); if (r) chars.push({ ch, top: r.top, h: r.height }); } }
      const tops = []; for (const c of chars) if (!tops.some(x => Math.abs(x - c.top) < c.h * 0.5)) tops.push(c.top);
      if (tops.length < 2) continue; const lastTop = Math.max(...tops); const last = chars.filter(c => Math.abs(c.top - lastTop) < c.h * 0.5).map(c => c.ch).join('');
      if (last.replace(/[。、．，,.!?！？：:；;）)」』】\]…ー〜~・]/g, '').length <= 2) out.orphans.push({ text: t.slice(0, 90), last, lines: tops.length, path: pathOf(el) });
      continue;
    }
    const words = []; const w2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (w2.nextNode()) { const n = w2.currentNode; if (blockOf(n.parentElement) !== el || !shown(n.parentElement)) continue; const re = /\S+/g; let m; while ((m = re.exec(n.nodeValue))) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const rr = [...rg.getClientRects()].filter(x => x.width > 0.5); if (rr.length) words.push({ w: m[0], top: rr[rr.length - 1].top, h: rr[0].height }); } }
    if (words.length < 3) continue; const lines = [];
    for (const x of words) { const L = lines.find(l => Math.abs(l.top - x.top) < Math.max(3, x.h * 0.5)); if (L) L.words.push(x.w); else lines.push({ top: x.top, words: [x.w] }); }
    if (lines.length < 2) continue; lines.sort((a, b) => a.top - b.top);
    const last = lines[lines.length - 1].words; const core = last.join('').replace(/[.,!?。、…:;)\]"'’”]/g, '');
    if (last.length === 1 && (HANGUL.test(core) ? core.length <= 2 : core.length <= 3)) out.orphans.push({ text: t.slice(0, 90), last: last[0], lines: lines.length, path: pathOf(el) });
  }

  const clipCache = new Map();
  const clipBox = el => { if (clipCache.has(el)) return clipCache.get(el); let box = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 }; for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const s = cs(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const r = a.getBoundingClientRect(); box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) }; } } clipCache.set(el, box); return box; };
  const layerOf = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = cs(e); if (s.position === 'fixed' || s.position === 'sticky' || (s.position === 'absolute' && s.zIndex !== 'auto')) return e; } return null; };
  const boxes = []; const tw3 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (tw3.nextNode()) { const n = tw3.currentNode; if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || SKIP.has(el.tagName) || !shown(el)) continue; const cb = clipBox(el); const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { const r = { left: Math.max(q.left, cb.left), top: Math.max(q.top, cb.top), right: Math.min(q.right, cb.right), bottom: Math.min(q.bottom, cb.bottom) }; r.height = r.bottom - r.top; if (r.right - r.left > 1 && r.height > 1) boxes.push({ r, el, fixed: layerOf(el), text: n.nodeValue.trim().slice(0, 30) }); } }
  boxes.sort((a, b) => a.r.top - b.r.top); const pairSeen = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length && boxes[j].r.top < boxes[i].r.bottom; j++) {
    const a = boxes[i], b = boxes[j]; if (a.el === b.el || a.el.contains(b.el) && a.text === b.text) continue; if (a.fixed !== b.fixed) continue;
    const ix = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), iy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ix > 2 && iy > Math.min(a.r.height, b.r.height) * 0.35) { const k = a.text + '|' + b.text; if (pairSeen.has(k)) continue; pairSeen.add(k); out.overlaps.push({ a: a.text, b: b.text, aPath: pathOf(a.el), bPath: pathOf(b.el), ix: Math.round(ix), iy: Math.round(iy) }); }
  }

  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
  const measure = (text, s) => { ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; return ctx.measureText(text).width; };
  for (const el of root.querySelectorAll('select')) { if (!shown(el)) continue; const s = cs(el); const opt = el.selectedOptions[0]; if (!opt) continue; const need = measure(opt.text, s); const arrow = s.appearance === 'none' ? 0 : 16; const avail = el.clientWidth - (parseFloat(s.paddingLeft) || 0) - (parseFloat(s.paddingRight) || 0) - arrow; if (need > avail + 1) out.selectClipped.push({ text: opt.text, need: Math.round(need), avail: Math.round(avail), path: pathOf(el) }); }
  for (const el of root.querySelectorAll('input[placeholder]')) { if (!shown(el) || el.value) continue; const s = cs(el); const need = measure(el.placeholder, s); const avail = el.clientWidth - (parseFloat(s.paddingLeft) || 0) - (parseFloat(s.paddingRight) || 0) - (el.type === 'search' ? 18 : 0); if (need > avail + 1) out.placeholderClipped.push({ text: el.placeholder, need: Math.round(need), avail: Math.round(avail), path: pathOf(el) }); }

  if (mobile) for (const el of root.querySelectorAll('button, a[href], [role="button"], [role="tab"], summary, select, input:not([type="hidden"]), textarea')) {
    if (!shown(el) && !(el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type))) continue;
    if (el.tagName === 'A' && cs(el).display === 'inline' && el.parentElement && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 10) continue;
    let box = el.getBoundingClientRect();
    if (el.tagName === 'INPUT' && /^(checkbox|radio)$/.test(el.type)) { const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)); if (lab && shown(lab)) box = lab.getBoundingClientRect(); else if (!shown(el)) continue; }
    if (box.width < 40 || box.height < 40) out.smallTargets.push({ text: label(el).slice(0, 40) || el.tagName.toLowerCase(), w: Math.round(box.width), h: Math.round(box.height), path: pathOf(el) });
  }
  return out;
}

// 스크롤에 따라 나타나는 머리글(전환 효과 포함)이 있어서, 스크롤 후 화면이 갱신될 때까지 기다린 뒤 판정하고, 가려졌으면 한 번 더 기다려 다시 본다.
async function hitTestInPage(opts) {
  const root = (opts.scope && document.querySelector(opts.scope)) || document.body; const out = [];
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const label = el => ((el.getAttribute && el.getAttribute('aria-label')) || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const pathOf = el => { const parts = []; for (let e = el, i = 0; e && e.nodeType === 1 && i < 3; e = e.parentElement, i++) { let s = e.tagName.toLowerCase(); const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter(Boolean).slice(0, 2) : []; if (cls.length) s += '.' + cls.join('.'); parts.unshift(s); } return parts.join(' > '); };
  const shown = el => { if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05 || s.pointerEvents === 'none') return false; if (e.parentElement && e.parentElement.tagName === 'DETAILS' && !e.parentElement.open && e.tagName !== 'SUMMARY') return false; } const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  // 열린 창·시트·배경막 뒤의 화면은 일부러 막아 둔 것이므로 가림으로 보지 않는다.
  const overlayOf = n => { for (let e = n; e && e.nodeType === 1; e = e.parentElement) { if (e.matches('[aria-modal="true"], [role="dialog"], dialog[open], .live-modal, .live-modal-backdrop, [class*="backdrop"], [class*="scrim"]')) return e; const s = getComputedStyle(e); if (s.position === 'fixed' && e.matches('.open, [open], [data-open="true"]')) return e; } return null; };
  const coveredBy = el => { const rects = el.getClientRects(); const r = rects.length > 1 ? rects[0] : el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; /* 여러 줄로 감싸진 인라인 링크는 첫 줄 글자 가운데를 누른다 */ if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'offscreen'; const top = document.elementFromPoint(x, y); if (!top || top === el || el.contains(top)) return null; const lab = top.closest('label'); if (lab && (lab.contains(el) || (el.id && lab.htmlFor === el.id))) return null; return top; };
  for (const el of root.querySelectorAll('button:not([disabled]), a[href], [role="button"], [role="tab"], summary, select, input:not([type="hidden"]):not([disabled]), textarea')) {
    if (!shown(el)) continue;
    if (el.tagName === 'A' && (el.getAttribute('href') || '').startsWith('#') && el.getBoundingClientRect().bottom < 0) continue;
    el.scrollIntoView({ block: 'center', inline: 'center' }); await frame();
    let top = coveredBy(el); if (top) { await wait(350); await frame(); if (!shown(el)) continue; top = coveredBy(el); }
    if (!top) continue;
    if (top !== 'offscreen') { const ov = overlayOf(top); if (ov && !ov.contains(el)) continue; }
    if (top === 'offscreen') out.push({ text: label(el), issue: 'not reachable on screen', path: pathOf(el) });
    else out.push({ text: label(el), issue: 'covered', by: `${pathOf(top)} «${label(top)}»`, path: pathOf(el) });
  }
  window.scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0;
  return out;
}

function bottomClearanceInPage() {
  const vh = innerHeight; const out = [];
  const scrollers = [document.scrollingElement, ...[...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2; })];
  for (const s of scrollers) s.scrollTop = s.scrollHeight;
  const bars = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); if (!/(fixed|sticky)/.test(s.position) || s.display === 'none' || s.visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.height > 20 && r.width > innerWidth * 0.5 && r.bottom >= vh - 2 && r.top > vh * 0.45; });
  if (bars.length) {
    const barTop = Math.min(...bars.map(b => b.getBoundingClientRect().top));
    const inFixed = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    for (const el of document.body.querySelectorAll('button, a[href], input, select, textarea, p, h1, h2, h3, h4, li, dd, dt, td, label, small')) {
      if (inFixed(el)) continue; const r = el.getBoundingClientRect(); if (r.width < 3 || r.height < 3) continue;
      const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') continue;
      if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      if (r.bottom > barTop + 3 && r.top < vh) out.push({ text: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50), hiddenPx: Math.round(Math.min(r.bottom, vh) - barTop), tag: el.tagName.toLowerCase() });
    }
  }
  for (const s of scrollers) s.scrollTop = 0;
  return out.slice(0, 12);
}

module.exports = { loadTranslations, settle, login, hideDevBadge, auditInPage, hitTestInPage, bottomClearanceInPage, sleep };
