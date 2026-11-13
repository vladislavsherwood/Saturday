/* Цикл 2. Из цикла 1: возврат резерва по тренду самой монеты убирает провалы, но бьёт по молодым падающим монетам (PUMP).
   Гипотеза: «отбой тревоги» надо брать с рынка в целом — тренд биткоина, динамика страха и доли стейблов, — а не с монеты.
   Запуск: node app/loop2.js <папка со страницами> */
const { lab, c, med, stable, report } = require('./lab.js');
const B = { act: 1.5, conds: [c('usdt', '>', 1.07), c('othd', '<', 25)] }, SC = [c('fng', '<', 52), c('usdtd', '<', 7.6)], STc = [...SC, c('fng', '<', 40)];
const ST = { act: -0.3, conds: STc }, WK = { act: -0.075, conds: SC }, TR = [c('sma50', '>', 1.1), c('sma200', '>', 1)];
const tx = (x) => x.map((k) => `${k.ind} ${k.op} ${k.v}`).join(' и ');
const L = [{ tag: 'С ГРАДАЦИЕЙ (эталон)', kind: 'base', S: { base: 1, rules: [B, ST, WK] } }, { tag: 'с возвратом по тренду монеты (для сравнения)', kind: 'ref', S: { base: 1, rules: [B, ST, WK, { act: 1.25, conds: TR }] } }];
const M = [];      // состояния рынка
for (const v of [0.9, 1, 1.1, 1.2]) M.push([c('btc200', '>', v)]);
for (const v of [1, 1.05, 1.1]) M.push([c('btc50', '>', v)], [c('btc50', '>', v), c('btc200', '>', 1)]);
for (const v of [0, 20, 40]) M.push([c('btcr90', '>', v)]);
for (const v of [0, 10, 20]) M.push([c('btcr30', '>', v)]);
for (const v of [5, 15, 30]) M.push([c('btcath', '<', v)]);
for (const v of [45, 50, 55, 60]) M.push([c('fngma', '>', v)]);
for (const v of [10, 20, 30]) M.push([c('fngd30', '>', v)]);
for (const v of [10, 20]) M.push([c('fngd7', '>', v)]);
for (const v of [-20, -10, 0]) M.push([c('usdm30', '<', v)]);
for (const v of [-15, -5]) M.push([c('usdm14', '<', v)]);
for (const v of [-3, 0, 3]) M.push([c('btcdm30', '<', v)], [c('btcdm30', '>', v)]);
for (const m of M) {
  for (const a of [1.05, 1.1, 1.25, 1.5]) {
    L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% резерва в день, если ${tx(m)}`, kind: 'a:возврат по рынку', x: tx(m), S: { base: 1, rules: [B, ST, WK, { act: a, conds: m }] } });
    L.push({ tag: `возврат ${Math.round((a - 1) * 100)}% в день, если ${tx(m)} и монета в тренде`, kind: 'b:возврат по рынку и монете', x: tx(m), S: { base: 1, rules: [B, ST, WK, { act: a, conds: [...m, c('sma50', '>', 1.1)] }] } });
  }
  // продажи только пока рынок НЕ в этом состоянии (то есть состояние = «тревога снята»)
  L.push({ tag: `не продавать, если ${tx(m)}`, kind: 'c:запрет продаж по рынку', x: tx(m), S: { base: 1, rules: [B, { act: 1, conds: [...SC, ...m] }, ST, WK] } });
  L.push({ tag: `сильная продажа только 7,5%, если ${tx(m)}`, kind: 'c:запрет продаж по рынку', x: tx(m), S: { base: 1, rules: [B, { act: -0.075, conds: [...STc, ...m] }, ST, WK] } });
}
// обратная сторона: продавать сильнее, когда рынок явно слаб
const W = [];
for (const v of [0.8, 0.9, 1]) W.push([c('btc200', '<', v)]);
for (const v of [-30, -15, 0]) W.push([c('btcr90', '<', v)]);
for (const v of [20, 40, 60]) W.push([c('btcath', '>', v)]);
for (const v of [10, 25]) W.push([c('usdm30', '>', v)]);
for (const v of [-20, -10]) W.push([c('fngd30', '<', v)]);
for (const v of [30, 40]) W.push([c('fngma', '<', v)]);
for (const w of W) for (const [ss, so] of [[-0.3, -0.075], [-0.5, -0.075], [-0.3, 0], [-0.5, -0.15]]) L.push({ tag: `сильная продажа ${-ss * 100}% только если ${tx(w)}, иначе ${-so * 100}%`, kind: 'd:сила продажи по рынку', x: tx(w), S: { base: 1, rules: [B, { act: ss, conds: [...STc, ...w] }, { act: so, conds: STc }, WK] } });
(async () => {
  const lb = await lab(process.argv[2]), rows = await lb.run(L), base = rows[0];
  console.log('вариантов', rows.length - 2); for (const r of rows.slice(0, 2)) console.log(`${r.tag}\n${report(r)}`);
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  for (const kind of [...new Set(rows.slice(2).map((r) => r.kind))]) {
    const pool = rows.filter((r) => r.kind === kind), ok = pool.filter((r) => stable(r, base, 'sel') && r.sel.med >= base.sel.med).sort((x, y) => sc(y.sel) - sc(x.sel)), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med);
    console.log(`\n[${kind}] вариантов ${pool.length}; не хуже эталона на отборе ${ok.length}; из них и на экзамене ${ok2.length}; медиана по вариантам на всех 31: ${med(pool.map((r) => r.all.med)).toFixed(0)}%, медиана худшей половины ${med(pool.map((r) => r.all.hworst)).toFixed(0)}%`);
    for (const r of ok.slice(0, 5)) console.log(`  ${r.tag} ${ok2.includes(r) ? '✔' : '✘'}\n${report(r)}`);
    const byX = {}; for (const r of ok) { const o = (byX[r.x] = byX[r.x] || [0, 0]); o[0]++; if (ok2.includes(r)) o[1]++; }
    if (ok.length) console.log('  признаки (отбор/экзамен): ' + Object.entries(byX).sort((x, y) => y[1][1] - x[1][1] || y[1][0] - x[1][0]).map(([k, v]) => `${k}: ${v[0]}/${v[1]}`).join(' ; '));
  }
  await lb.close();
})();
