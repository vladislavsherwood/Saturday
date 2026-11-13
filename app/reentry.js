/* Возврат резерва: минусы «мягкой с градацией» появляются, когда монета продана на медвежьем рынке,
   а сигнал покупки потом долго не приходит. Проверяется третье правило — постепенно возвращать резерв, когда рынок развернулся.
   Запуск: node app/reentry.js <папка со страницами> <куда.json> */
const { chromium } = require('playwright');
const fs = require('fs');
const { inPage, open } = require('./simple.js');
const c = (ind, op, v) => ({ ind, op, v });
const B = { act: 1.5, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], ST = { act: -0.3, conds: [...SC, c('fng', '<', 40)] }, WK = { act: -0.075, conds: SC };
const X = [];
for (const v of [0.95, 1, 1.05, 1.1, 1.2, 1.35]) X.push([c('sma200', '>', v)]);
for (const v of [1, 1.05, 1.1]) X.push([c('sma50', '>', v)], [c('sma50', '>', v), c('sma200', '>', 1)]);
for (const v of [50, 55, 60, 65, 70, 75]) X.push([c('fng', '>', v)], [c('fng', '>', v), c('sma200', '>', 1)]);
for (const v of [0, 20, 40, 80]) X.push([c('ret90', '>', v)]);
for (const v of [0, 15, 30]) X.push([c('ret30', '>', v)]);
for (const v of [10, 20, 30]) X.push([c('dd', '<', v)]);
for (const v of [5, 15, 30]) X.push([c('ath', '<', v)]);
for (const v of [1, 1.1]) X.push([c('pair', '>', v)]);
for (const v of [0.8, 0.9, 1]) X.push([c('usdt', '<', v)]);
for (const v of [3.5, 4.5]) X.push([c('usdtd', '<', v)]);
for (const v of [55, 60]) X.push([c('btcd', '>', v)]);
for (const v of [55, 60, 65]) X.push([c('rsi', '>', v)]);
const L = [{ tag: 'без возврата (30 / 7,5)', S: { base: 1, rules: [B, ST, WK] } }];
const tx = (x) => x.map((k) => `${k.ind} ${k.op} ${k.v}`).join(' и ');
for (const x of X) for (const a of [1.02, 1.05, 1.1, 1.25, 1.5, 2]) for (const first of [1, 0]) { const r = { act: a, conds: x }; L.push({ tag: `вернуть ${Math.round((a - 1) * 100)}% резерва в день, если ${tx(x)} (${first ? 'до продаж' : 'после продаж'})`, x: tx(x), a, S: { base: 1, rules: first ? [B, r, ST, WK] : [B, ST, WK, r] } }); }
const med = (v) => { const s = [...v].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const stat = (full, halves) => ({ pos: full.filter((x) => x > 0).length, worst: Math.min(...full), med: med(full), hpos: halves.filter((x) => x > 0).length, hworst: Math.min(...halves) });
const sh = (s) => `в плюсе ${s.pos}, худшая ${s.worst.toFixed(0)}%, медиана ${s.med.toFixed(0)}%, половины ${s.hpos}, худшая половина ${s.hworst.toFixed(0)}%`;
(async () => {
  const [dir, outPath] = process.argv.slice(2), browser = await chromium.launch(), R = {};
  const P = { own: 'strategy-builder-sol', valid: 'valid', exam: 'exam', memes: 'memes6', metals: 'metals' }, SEL = ['own', 'valid'], EX = ['exam', 'memes'], ALL = [...SEL, ...EX];
  for (const g in P) { const page = await open(browser, `${dir}/${P[g]}.html`, 're'); R[g] = {}; for (const part of ['full', 'h1', 'h2']) R[g][part] = await page.evaluate(inPage, { seed: 1, unit: 10, evalMany: L.map((x) => x.S), part }); await page.close(); }
  const get = (i, g, part) => g.flatMap((k) => R[k][part][i].e), nm = (part) => ALL.flatMap((k) => R[k][part][0].names.map((n) => n + (part === 'full' ? '' : part === 'h1' ? ' (1-я пол.)' : ' (2-я пол.)')));
  const neg = (i) => { const out = []; for (const part of ['full', 'h1', 'h2']) { const e = get(i, ALL, part), n = nm(part); e.forEach((v, k) => { if (v < 0) out.push(`${n[k]} ${v.toFixed(0)}%`); }); } return out.join(', ') || 'нет'; };
  const rows = L.map((x, i) => ({ ...x, i, sel: stat(get(i, SEL, 'full'), [...get(i, SEL, 'h1'), ...get(i, SEL, 'h2')]), ex: stat(get(i, EX, 'full'), [...get(i, EX, 'h1'), ...get(i, EX, 'h2')]), all: stat(get(i, ALL, 'full'), [...get(i, ALL, 'h1'), ...get(i, ALL, 'h2')]), h2: stat(get(i, ALL, 'h2'), get(i, ALL, 'h2')), met: R.metals.full[i].e.map((v) => Math.round(v)) }));
  const base = rows[0];
  console.log('вариантов', rows.length - 1);
  console.log(`БАЗА: отбор ${sh(base.sel)}\n      экзамен ${sh(base.ex)}\n      все 31 ${sh(base.all)} | 2-я половина медиана ${base.h2.med.toFixed(0)}% | металлы ${base.met.join('/')}\n      в минусе: ${neg(0)}`);
  const better = (r, k) => r[k].worst >= base[k].worst && r[k].hworst >= base[k].hworst && r[k].hpos >= base[k].hpos;
  const ok = rows.slice(1).filter((r) => better(r, 'sel') && r.sel.med >= base.sel.med * 0.9).sort((x, y) => (y.sel.hworst + y.sel.worst + y.sel.med / 5) - (x.sel.hworst + x.sel.worst + x.sel.med / 5));
  const ok2 = ok.filter((r) => better(r, 'ex') && r.ex.med >= base.ex.med * 0.9);
  console.log(`\nна отборе не хуже базы по устойчивости и прибыль не ниже 90%: ${ok.length}; из них на экзамене тоже: ${ok2.length}`);
  for (const r of ok.slice(0, 8)) console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)}\n     экзамен: ${sh(r.ex)} ${ok2.includes(r) ? '✔' : '✘'}\n     все 31: ${sh(r.all)} | 2-я половина медиана ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}\n     в минусе: ${neg(r.i)}`);
  const byX = {}; for (const r of ok) { const o = (byX[r.x] = byX[r.x] || { n: 0, ex: 0 }); o.n++; if (ok2.includes(r)) o.ex++; }
  console.log('признаки возврата (прошло отбор / экзамен): ' + Object.entries(byX).sort((x, y) => y[1].ex - x[1].ex).map(([k, v]) => `${k}: ${v.n}/${v.ex}`).join(' ; '));
  const fewest = rows.slice(1).map((r) => ({ r, n: ['full', 'h1', 'h2'].reduce((s, part) => s + get(r.i, ALL, part).filter((v) => v < 0).length, 0) })).sort((x, y) => x.n - y.n || y.r.all.med - x.r.all.med).slice(0, 4);
  console.log('\nМЕНЬШЕ ВСЕГО МИНУСОВ на всех 31 (подсмотрено по всем монетам, не отбор):');
  for (const { r, n } of fewest) console.log(`  ${r.tag}: минусов ${n}; ${sh(r.all)}\n     в минусе: ${neg(r.i)}`);
  console.log('\nВОЗВРАТ ПО ТРЕНДУ, отдельно отбор и экзамен:');
  for (const r of rows.filter((q) => q.x && /^sma50 > 1\.1( и sma200 > 1)?$|^rsi > 65$|^sma200 > 1\.1$/.test(q.x) && [1.25, 1.5, 2].includes(q.a))) console.log(`  ${r.tag}\n     отбор: ${sh(r.sel)} | экзамен: ${sh(r.ex)} | 2-я пол. медиана ${r.h2.med.toFixed(0)}% | металлы ${r.met.join('/')}`);
  fs.writeFileSync(outPath, JSON.stringify({ base, ok: ok.slice(0, 30) }));
  await browser.close();
})();
