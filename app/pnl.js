/* Продажи и покупки от прибыли позиции: pnl — на сколько процентов цена выше средней цены покупки.
   1. Отдельно от всего: фиксация прибыли (pnl > X → продать часть), с докупкой обратно и без.
   2. Стоп: pnl < −X → продать часть.
   3. Добавки к «мягкой» стратегии: фиксация, стоп, усреднение вниз, «не продавать в убытке».

   Запуск: node app/pnl.js <папка со страницами> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');

const c = (ind, op, v) => ({ ind, op, v });
const BC = [c('usdt', '>', 1.07), c('othd', '<', 25)], SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)];
const GB = { act: 1.5, conds: BC }, GS = { act: -0.1, conds: SC };
const L = [{ S: { base: 1, rules: [GB, GS] }, tag: 'МЯГКАЯ', kind: 'base' }];
const pc = (a) => (a < 0 ? `продать ${+(-a * 100).toFixed(1)}%` : a === 0 ? 'пропустить' : `взнос + ${Math.round((a - 1) * 100)}% резерва`);
const TP = [30, 50, 100, 200, 300, 500, 1000], F = [-0.01, -0.02, -0.05, -0.1, -0.25];
for (const x of TP) for (const f of F) {
  const tp = { act: f, conds: [c('pnl', '>', x)] };
  L.push({ S: { base: 1, rules: [tp] }, tag: `прибыль > ${x}% → ${pc(f)}`, kind: 'tp', x, f });
  for (const y of [0, -20, -40, -60]) for (const b of [1.5, 2]) L.push({ S: { base: 1, rules: [tp, { act: b, conds: [c('pnl', '<', y)] }] }, tag: `прибыль > ${x}% → ${pc(f)} | прибыль < ${y}% → ${pc(b)}`, kind: 'tp+re', x, f, y, b });
  for (const first of [1, 0]) L.push({ S: { base: 1, rules: first ? [tp, GB, GS] : [GB, GS, tp] }, tag: `мягкая + прибыль > ${x}% → ${pc(f)} (${first ? 'первым' : 'последним'})`, kind: 'g+tp', x, f });
}
for (const x of [20, 30, 40, 50, 60, 70]) {
  for (const f of [-0.05, -0.1, -0.25, -0.5]) {
    const sl = { act: f, conds: [c('pnl', '<', -x)] };
    L.push({ S: { base: 1, rules: [sl] }, tag: `убыток > ${x}% → ${pc(f)}`, kind: 'sl', x, f });
    for (const first of [1, 0]) L.push({ S: { base: 1, rules: first ? [sl, GB, GS] : [GB, GS, sl] }, tag: `мягкая + убыток > ${x}% → ${pc(f)} (${first ? 'первым' : 'последним'})`, kind: 'g+sl', x, f });
  }
  for (const b of [1.25, 1.5, 2]) for (const first of [1, 0]) { const av = { act: b, conds: [c('pnl', '<', -x)] }; L.push({ S: { base: 1, rules: first ? [av, GB, GS] : [GB, GS, av] }, tag: `мягкая + убыток > ${x}% → ${pc(b)} (${first ? 'первым' : 'последним'})`, kind: 'g+avg', x, b }); }
}
// сигнал продажи мягкой — только если позиция в прибыли (или только в убытке); сигнал покупки — только если позиция дешевле средней
for (const y of [-50, -30, -10, 0, 20, 50, 100, 200]) for (const op of ['>', '<']) {
  for (const f of [-0.1, -0.25]) L.push({ S: { base: 1, rules: [GB, { act: f, conds: [...SC, c('pnl', op, y)] }] }, tag: `мягкая, но продажа только при прибыли ${op} ${y}% → ${pc(f)}`, kind: 'g:sell', y, op });
  for (const f of [[-0.25, -0.05], [-0.25, -0.1], [-0.2, 0]]) L.push({ S: { base: 1, rules: [GB, { act: f[0], conds: [...SC, c('pnl', op, y)] }, { act: f[1], conds: SC }] }, tag: `мягкая, продажа: при прибыли ${op} ${y}% → ${pc(f[0])}, иначе ${pc(f[1])}`, kind: 'g:sell2', y, op });
  for (const b of [[2, 1.25], [2, 1], [1.5, 1]]) L.push({ S: { base: 1, rules: [{ act: b[0], conds: [...BC, c('pnl', op, y)] }, { act: b[1], conds: BC }, GS] }, tag: `мягкая, покупка: при прибыли ${op} ${y}% → ${pc(b[0])}, иначе ${pc(b[1])}`, kind: 'g:buy2', y, op });
}
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ n: full.length, pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hn: halves.length, hworst: Math.min(...halves), hmed: med(halves) });
const show = (t, s) => `${t}: в плюсе ${s.pos}/${s.n}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}% | половины: в плюсе ${s.hpos}/${s.hn}, худшая ${s.hworst.toFixed(0)}%, медиана ${s.hmed.toFixed(0)}%`;
(async () => {
  const [dir, outPath] = process.argv.slice(2), browser = await chromium.launch(), R = {};
  const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  for (const g in P) { const page = await open(browser, `${dir}/${P[g]}.html`, 'pnl'); R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part }); await page.close(); }
  const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e);
  const rows = L.map((x, i) => ({ ...x, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]),
    all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), met: R.metals.full[i].e.map((v) => Math.round(v)) }));
  const base = rows[0];
  console.log('кандидатов', rows.length); console.log(show('МЯГКАЯ, все 31', base.all));
  console.log('\n=== 1. ФИКСАЦИЯ ПРИБЫЛИ без других правил, все 31 монета: медиана / худшая / в плюсе ===');
  for (const f of F) console.log(`${pc(f)}:  ` + rows.filter((r) => r.kind === 'tp' && r.f === f).map((r) => `>${r.x}%: ${r.all.med.toFixed(0)}/${r.all.worst.toFixed(0)}/${r.all.pos}`).join('  '));
  const top = (kind, n, key = 'all') => rows.filter((r) => r.kind === kind).sort((x, y) => (y[key].worst + y[key].med / 10) - (x[key].worst + x[key].med / 10)).slice(0, n);
  console.log('--- с докупкой обратно, лучшие по худшей монете:'); for (const r of top('tp+re', 6)) console.log('  ' + show(r.tag, r.all) + ' | металлы ' + r.met.join('/'));
  console.log('\n=== 2. СТОП по убытку без других правил: медиана / худшая / в плюсе ===');
  for (const f of [-0.05, -0.1, -0.25, -0.5]) console.log(`${pc(f)}:  ` + rows.filter((r) => r.kind === 'sl' && r.f === f).map((r) => `<-${r.x}%: ${r.all.med.toFixed(0)}/${r.all.worst.toFixed(0)}/${r.all.pos}`).join('  '));
  const stable = (r, k) => r[k].pos >= base[k].pos && r[k].worst >= base[k].worst && r[k].hpos >= base[k].hpos && r[k].hworst >= base[k].hworst;
  console.log('\n=== 3. ДОБАВКИ К МЯГКОЙ (отбор на 17 → экзамен на 14) ===');
  console.log(show('  мягкая, отбор', base.sel)); console.log(show('  мягкая, экзамен', base.ex));
  const out = {};
  for (const [kind, name] of [['g+tp', 'фиксация прибыли'], ['g+sl', 'стоп по убытку'], ['g+avg', 'усреднение вниз'], ['g:sell', 'продажа только при условии на прибыль'], ['g:sell2', 'сила продажи от прибыли'], ['g:buy2', 'сила покупки от прибыли']]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, 'sel') && r.sel.med > base.sel.med).sort((x, y) => y.sel.med - x.sel.med), ok2 = ok.filter((r) => stable(r, 'ex') && r.ex.med > base.ex.med);
    const b = [...pool].sort((x, y) => y.all.med - x.all.med)[0];
    console.log(`\n[${name}] вариантов ${pool.length}; прошли отбор ${ok.length}; из них экзамен ${ok2.length}; медиана по вариантам на всех 31: ${med(pool.map((r) => r.all.med)).toFixed(0)}% (мягкая ${base.all.med.toFixed(0)}%)`);
    for (const r of ok.slice(0, 4)) { console.log('  ' + r.tag); console.log(show('     отбор', r.sel)); console.log(show('     экзамен', r.ex) + (ok2.includes(r) ? '  ✔' : '  ✘')); console.log(show('     все 31', r.all) + ' | металлы ' + r.met.join('/')); }
    if (!ok.length) { console.log('  лучший по медиане на всех 31: ' + b.tag); console.log(show('     все 31', b.all)); }
    out[kind] = ok.slice(0, 20);
  }
  fs.writeFileSync(outPath, JSON.stringify({ base, out, tp: rows.filter((r) => r.kind === 'tp' || r.kind === 'sl') }));
  await browser.close();
})();
