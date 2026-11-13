/* Одна стратегия из двух: «с возвратом» (страх, стейблы, импульс биткоина) и «от обратного» (маркеры вершин и дна).
   Каждое место стратегии — слот с несколькими вариантами из обеих; перебираются все сочетания.
   Выбор по 17 монетам отбора, экзамен на 14, затем лучшие — на 50 случайных.
   Запуск: node app/merge.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, med, stable, report } = require('./lab.js');
const HERE = __dirname;
const A = JSON.parse(fs.readFileSync(HERE + '/found/gentle-impulse.json', 'utf8')), M = JSON.parse(fs.readFileSync(HERE + '/found/markers-top.json', 'utf8'));
const BC = [c('usdt', '>', 1.07), c('othd', '<', 25)], SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STc = [c('fng', '<', 40), c('usdtd', '<', 7.6)], RBc = [c('btcr30', '>', 20)];
const SLOT = {
  top: [['нет', []], ['на максимуме, 5 маркеров → 100%', [{ act: -1, conds: [c('hi90', '>', 0.5), c('topm', '>', 4.5)] }]], ['на максимуме, 4 маркера → 50%', [{ act: -0.5, conds: [c('hi90', '>', 0.5), c('topm', '>', 3.5)] }]],
    ['на максимуме: 5 → 100%, 4 → 25%', [{ act: -1, conds: [c('hi90', '>', 0.5), c('topm', '>', 4.5)] }, { act: -0.25, conds: [c('hi90', '>', 0.5), c('topm', '>', 3.5)] }]],
    ['на максимуме: 5 → 100%, 4 → 10%, 3 → 3%', [{ act: -1, conds: [c('hi90', '>', 0.5), c('topm', '>', 4.5)] }, { act: -0.1, conds: [c('hi90', '>', 0.5), c('topm', '>', 3.5)] }, { act: -0.03, conds: [c('hi90', '>', 0.5), c('topm', '>', 2.5)] }]],
    ['выше средней 200, 5 маркеров → 100%', [{ act: -1, conds: [c('sma200', '>', 1), c('topm', '>', 4.5)] }]]],
  buy: [['паника в стейблах → 50%', [{ act: 1.5, conds: BC }]], ['паника: 100% при 3+ маркерах дна, иначе 50%', [{ act: 2, conds: [...BC, c('botm', '>', 2.5)] }, { act: 1.5, conds: BC }]],
    ['паника: 100% без маркеров вершины, иначе 25%', [{ act: 2, conds: [...BC, c('topm', '<', 1.5)] }, { act: 1.25, conds: BC }]]],
  bottom: [['нет', []], ['4 маркера дна → 50%', [{ act: 1.5, conds: [c('botm', '>', 3.5)] }]], ['на минимуме и 3+ маркера дна → 100%', [{ act: 2, conds: [c('lo90', '>', 0.5), c('botm', '>', 2.5)] }]]],
  sell: [['страх: 30% / 16%', [{ act: -0.3, conds: STc }, { act: -0.16, conds: SC }]], ['страх: 50% при 2+ маркерах вершины, иначе 30% / 16%', [{ act: -0.5, conds: [...STc, c('topm', '>', 1.5)] }, { act: -0.3, conds: STc }, { act: -0.16, conds: SC }]],
    ['страх, но не при 4 маркерах дна', [{ act: 1, conds: [...SC, c('botm', '>', 3.5)] }, { act: -0.3, conds: STc }, { act: -0.16, conds: SC }]],
    ['страх: слабая продажа только при 1+ маркере вершины', [{ act: -0.3, conds: STc }, { act: -0.16, conds: [...SC, c('topm', '>', 0.5)] }]],
    ['страх: 30% / 16%, а при 3+ маркерах дна 10% / 5%', [{ act: -0.1, conds: [...STc, c('botm', '>', 2.5)] }, { act: -0.05, conds: [...SC, c('botm', '>', 2.5)] }, { act: -0.3, conds: STc }, { act: -0.16, conds: SC }]]],
  ret: [['импульс биткоина → весь резерв', [{ act: 2, conds: RBc }]], ['импульс биткоина, если маркеров вершины < 4', [{ act: 2, conds: [...RBc, c('topm', '<', 3.5)] }]],
    ['импульс биткоина или максимум без маркеров вершины', [{ act: 2, conds: RBc }, { act: 2, conds: [c('hi90', '>', 0.5), c('topm', '<', 1.5)] }]],
    ['импульс биткоина или 3+ маркера дна при цене выше средней 50', [{ act: 2, conds: RBc }, { act: 2, conds: [c('botm', '>', 2.5), c('sma50', '>', 1)] }]]],
};
const L = [{ tag: 'С ВОЗВРАТОМ (текущая)', kind: 'ref', S: A }, { tag: 'С МАРКЕРОМ ВЕРШИНЫ (новая)', kind: 'ref', S: { base: 1, rules: M.rules } }];
for (const t of SLOT.top) for (const b of SLOT.buy) for (const bo of SLOT.bottom) for (const s of SLOT.sell) for (const r of SLOT.ret)
  L.push({ kind: 'm', parts: [t[0], b[0], bo[0], s[0], r[0]], tag: `вершина: ${t[0]} | покупка: ${b[0]} | дно: ${bo[0]} | продажи: ${s[0]} | возврат: ${r[0]}`, S: { base: 1, rules: [...bo[1], ...b[1], ...t[1], ...s[1], ...r[1]] } });
(async () => {
  let lb = await lab(process.argv[2]), rows = await lb.run(L); await lb.close();
  const a = rows[0], m = rows[1], pool = rows.filter((r) => r.kind === 'm');
  console.log('сочетаний', pool.length); for (const r of [a, m]) console.log(r.tag + '\n' + report(r));
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  // не хуже ОБЕИХ исходных по устойчивости и прибыльнее обеих — сначала на отборе, потом на экзамене
  const beat = (r, k) => stable(r, a, k) && stable(r, m, k) && r[k].med > Math.max(a[k].med, m[k].med);
  const ok = pool.filter((r) => beat(r, 'sel')).sort((x, y) => sc(y.sel) - sc(x.sel)), ok2 = ok.filter((r) => beat(r, 'ex'));
  console.log(`\nлучше обеих на отборе: ${ok.length}; из них лучше обеих и на экзамене: ${ok2.length}`);
  // какие варианты слотов чаще встречаются среди прошедших экзамен
  for (const [i, name] of [[0, 'вершина'], [1, 'покупка'], [2, 'дно'], [3, 'продажи'], [4, 'возврат']]) {
    const cnt = {}; for (const r of pool) { const o = (cnt[r.parts[i]] = cnt[r.parts[i]] || [0, 0, 0]); o[0]++; if (ok.includes(r)) o[1]++; if (ok2.includes(r)) o[2]++; }
    console.log(`  ${name}: ` + Object.entries(cnt).map(([k, v]) => `«${k}» ${v[1]}/${v[2]}`).join(' ; '));
  }
  const cand = (ok2.length ? ok2 : ok).slice(0, 12);
  fs.writeFileSync(process.argv[3], JSON.stringify({ cand: cand.map((r) => ({ tag: r.tag, S: r.S })) }));
  // лучшие — на 50 случайных
  lb = await lab(process.argv[2], { rnd: true });
  const rr = await lb.run([{ tag: a.tag, S: A }, { tag: m.tag, S: { base: 1, rules: M.rules } }, ...cand.map((r) => ({ tag: r.tag, S: r.S }))]); await lb.close();
  console.log('\nЛУЧШИЕ ПО ОТБОРУ ИЗ ПРОШЕДШИХ ЭКЗАМЕН — с 50 случайными монетами:');
  for (const r of rr) console.log(`  ${r.tag}\n${report(r)}`);
  fs.writeFileSync(process.argv[3], JSON.stringify({ rows: rr.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, all: r.all, rnd: r.rnd, h2: r.h2, neg: r.neg })) }));
})();
