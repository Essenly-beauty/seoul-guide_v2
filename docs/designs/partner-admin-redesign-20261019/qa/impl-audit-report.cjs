// impl-layout-audit 결과(JSON)를 모아 "같은 문제는 한 번만" 보이게 묶는다 (2026-10-21).
// 실행: node docs/designs/partner-admin-redesign-20261019/qa/impl-audit-report.cjs <AUDIT_OUT 폴더> [--json out.json]
// 묶는 기준: 문제 종류 + 요소 위치(path) + 글자. 어떤 화면 크기·언어·상태에서 나왔는지를 함께 적는다.
const fs = require('fs'), path = require('path');
const dir = process.argv[2]; const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const runs = fs.readdirSync(dir).filter(d => fs.statSync(path.join(dir, d)).isDirectory());
const groups = new Map(); const errors = []; const failedStates = []; const coverage = [];
const add = (kind, severity, key, item, where) => {
  const k = kind + '|' + key; let g = groups.get(k);
  if (!g) { g = { kind, severity, key, example: item, where: new Set(), states: new Set(), runs: new Set() }; groups.set(k, g); }
  g.where.add(where.run); g.states.add(where.state); g.runs.add(`${where.run}/${where.state}`);
};
const norm = s => String(s || '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
for (const run of runs) {
  const files = fs.readdirSync(path.join(dir, run)).filter(f => f.endsWith('.json'));
  coverage.push(`${run}: ${files.length} states`);
  const summary = fs.existsSync(path.join(dir, run, 'summary.txt')) ? fs.readFileSync(path.join(dir, run, 'summary.txt'), 'utf8') : '';
  for (const line of summary.split('\n')) if (/SETUP-FAILED|ERROR/.test(line)) failedStates.push(`${run}: ${line}`);
  for (const f of files) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, run, f), 'utf8')); const where = { run, state: r.id }; const L = r.layout;
    for (const e of r.errors || []) errors.push(`${run}/${r.id}: ${e}`);
    if (L.pageOverflow) add('page-overflow', 'high', norm(L.pageOverflow.culprits[0]), L.pageOverflow, where);
    for (const x of L.clipped) {
      if (x.kind === 'lineClamp') continue;
      add(x.kind === 'ellipsis' ? 'ellipsis' : x.kind === 'clipY' ? 'text-cut-vertical' : 'content-cut', x.kind === 'ellipsis' ? 'info' : 'high', `${x.path}|${norm(x.text).slice(0, 40)}`, x, where);
    }
    for (const x of L.spills) if (!x.clipped) add('text-spills-box', 'medium', `${x.path}|${norm(x.text).slice(0, 40)}`, x, where);
    for (const x of L.offscreen) add('cut-at-screen-edge', 'high', `${x.path}|${norm(x.text).slice(0, 40)}`, x, where);
    for (const x of L.controlWraps) add('label-wraps', 'medium', `${x.path}|${x.text}`, x, where);
    for (const x of L.wordBreaks) add(x.forced ? 'word-forced-break' : 'word-split', x.forced ? 'medium' : 'medium', `${x.path}|${x.word}`, x, where);
    for (const x of L.orphans) add('orphan-line', 'low', `${x.path}|${norm(x.text).slice(0, 50)}`, x, where);
    for (const x of L.overlaps) add('text-overlap', 'high', `${x.aPath}|${x.bPath}|${norm(x.a)}|${norm(x.b)}`, x, where);
    for (const x of L.selectClipped) add('select-text-cut', 'medium', `${x.path}|${x.text}`, x, where);
    for (const x of L.placeholderClipped) add('placeholder-cut', 'low', `${x.path}|${x.text}`, x, where);
    for (const x of L.smallTargets) add('small-touch-target', 'low', `${x.path}|${norm(x.text).slice(0, 30)}`, x, where);
    for (const x of r.clearance || []) add('hidden-under-bottom-bar', 'high', `${x.tag}|${norm(x.text).slice(0, 40)}`, x, where);
    for (const x of r.hits || []) add(x.issue === 'covered' ? 'button-covered' : 'button-unreachable', 'high', `${x.path}|${norm(x.text)}|${norm(x.by || '')}`, x, where);
  }
}
const order = { high: 0, medium: 1, low: 2, info: 3 };
const list = [...groups.values()].map(g => ({ kind: g.kind, severity: g.severity, example: g.example, count: g.runs.size, runs: [...g.where].sort(), states: [...g.states].sort() }))
  .sort((a, b) => order[a.severity] - order[b.severity] || a.kind.localeCompare(b.kind) || b.count - a.count);
const byKind = {}; for (const g of list) byKind[g.kind] = (byKind[g.kind] || 0) + 1;
console.log('coverage:\n  ' + coverage.join('\n  '));
if (failedStates.length) console.log('\nstates that could not be reached:\n  ' + failedStates.join('\n  '));
console.log('\nissue groups by kind: ' + JSON.stringify(byKind));
if (errors.length) console.log(`\npage/console errors (${errors.length}):\n  ` + [...new Set(errors)].slice(0, 30).join('\n  '));
for (const g of list) {
  if (g.severity === 'info') continue;
  const e = g.example; const what = e.text || e.word || e.a && `${e.a} ↔ ${e.b}` || e.culprits && e.culprits.join(' ; ') || '';
  console.log(`\n[${g.severity}] ${g.kind} ×${g.count}  «${String(what).slice(0, 90)}»${e.word ? ` in «${String(e.context).slice(0, 70)}»` : ''}${e.cut ? ` cut=${JSON.stringify(e.cut)}` : ''}${e.lines ? ` lines=${e.lines}` : ''}${e.by ? ` by ${e.by}` : ''}${e.w ? ` ${e.w}×${e.h}` : ''}${e.need ? ` need=${e.need} avail=${e.avail}` : ''}${e.over ? ` over=${e.over}px` : ''}\n   path: ${e.path || e.aPath || ''}\n   runs: ${g.runs.join(', ')}\n   states: ${g.states.join(', ')}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ coverage, failedStates, errors: [...new Set(errors)], groups: list }, null, 1));
