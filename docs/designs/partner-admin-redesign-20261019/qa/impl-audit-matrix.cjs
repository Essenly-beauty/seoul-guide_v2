// 화면 크기·언어 조합 전체에 대해 impl-layout-audit / impl-controls-audit 을 동시에 N개씩 돌린다 (2026-10-21).
// 실행: NODE_PATH=$PWD/node_modules MATRIX=layout|controls [MATRIX_OUT=dir] [MATRIX_JOBS=4] [MATRIX_ONLY=admin|customer] [MATRIX_URL_ADMIN=http://127.0.0.1:3114] [MATRIX_URL_CUSTOMER=…] node docs/designs/partner-admin-redesign-20261019/qa/impl-audit-matrix.cjs
const { spawn } = require('child_process'); const fs = require('fs'), os = require('os'), path = require('path');
const KIND = process.env.MATRIX || 'layout'; const JOBS = Number(process.env.MATRIX_JOBS || 4);
const OUT = process.env.MATRIX_OUT || path.join(os.tmpdir(), `${KIND}-audit`); fs.mkdirSync(OUT, { recursive: true });
const ADMIN_VP = ['1920x1080', '1440x900', '1280x800', '1024x768', '820x1180', '768x1024', '390x844', '360x780'];
const CUSTOMER_EN_VP = ['1440x900', '768x1024', '430x932', '390x844', '360x780', '320x640'];
const CUSTOMER_I18N_VP = ['390x844', '360x780'];
let combos = KIND === 'layout'
  ? [...ADMIN_VP.map(v => ['admin', 'ko', v]), ...CUSTOMER_EN_VP.map(v => ['customer', 'en', v]), ...['ja', 'zh-CN', 'es', 'fr'].flatMap(l => CUSTOMER_I18N_VP.map(v => ['customer', l, v]))]
  : [['admin', 'ko', '1440x900'], ['admin', 'ko', '390x844'], ['customer', 'en', '390x844'], ['customer', 'en', '1440x900'], ['customer', 'fr', '360x780']];
if (process.env.MATRIX_ONLY) combos = combos.filter(c => c[0] === process.env.MATRIX_ONLY);
// 이미 끝난 조합(summary.txt 있음)은 건너뛴다 — 중단된 실행을 이어서 돌릴 때
if (process.env.MATRIX_RESUME) combos = combos.filter(([side, locale, vp]) => !fs.existsSync(path.join(OUT, `${side}-${locale}-${vp}`, KIND === 'layout' ? 'summary.txt' : 'controls.json')));
const script = path.join(__dirname, KIND === 'layout' ? 'impl-layout-audit.cjs' : 'impl-controls-audit.cjs');
const P = KIND === 'layout' ? 'AUDIT' : 'CTRL';
let next = 0, running = 0; const started = Date.now();
const launch = () => {
  while (running < JOBS && next < combos.length) {
    const [side, locale, vp] = combos[next++]; running++;
    const log = path.join(OUT, `log-${side}-${locale}-${vp}.txt`); const fd = fs.openSync(log, 'w'); const t0 = Date.now();
    const child = spawn(process.execPath, [script], { env: { ...process.env, ...(process.env[`MATRIX_URL_${side.toUpperCase()}`] ? { QA_IMPL_URL: process.env[`MATRIX_URL_${side.toUpperCase()}`] } : {}), [`${P}_SIDE`]: side, [`${P}_LOCALE`]: locale, [`${P}_VIEWPORT`]: vp, [`${P}_OUT`]: OUT }, stdio: ['ignore', fd, fd] });
    child.on('exit', code => { running--; console.log(`${side} ${locale} ${vp} exit=${code} ${Math.round((Date.now() - t0) / 1000)}s`); if (next >= combos.length && running === 0) console.log(`all done in ${Math.round((Date.now() - started) / 60000)} min → ${OUT}`); launch(); });
  }
};
console.log(`${combos.length} runs, ${JOBS} at a time → ${OUT}`); launch();
