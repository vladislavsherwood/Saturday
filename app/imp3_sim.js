/* imp3 (агент улучшения №3): продажи на страхе. Помощники поверх combo_sim.js (быстрый оценщик agent_sim.js).
   Основа — found/combo-best.json (F + C1.25 + C6). Продажи на страхе — правила act < 0 с условием fng < 52 (их 4: 37,5/30/20/16%).
   Признаки эпизода страха (только прошлое; день решения — вчерашний, как у всех индикаторов):
   «день страха» = fng < 52 и usdtd < U (U = 7,6 по умолчанию). Эпизод — дни страха, разрывы без страха ≤ g дней (иначе новый эпизод).
     fepn{g}  — номер дня страха в эпизоде (1, 2, …), вне эпизода NaN;
     fepd{g}  — календарных дней от начала эпизода;
     fepc{g}  — изменение цены монеты от начала эпизода, %;  fepb{g} — то же для BTC;
     frem{g}  — какая доля монеты осталась бы после продаж эпизода по рыночному графику (0,7 за день fng < 40, 0,84 за прочий день страха), до сегодняшнего дня включительно.
   Использование: const Z = require('./imp3_sim.js'); const G = Z.load(); const S = Z.mod(Z.BASE, [[[c('fepn14','>',10)], 0.5]]) */
const K = require('./combo_sim.js');
const fs = require('fs');
const { c } = K;
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE = { base: BEST.base, rules: BEST.rules };
const isFear = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'fng' && x.v === 52);
// копии перед каждым правилом продажи на страхе: список [условия, множитель] — первая сработавшая; множитель 0 → обычный день (только взнос, act 1)
const mod = (S, L, which = isFear) => ({ ...S, rules: S.rules.flatMap((r) => (which(r) ? [...L.map(([cs, k]) => ({ act: k === 0 ? 1 : Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...cs] })), r] : [r])) });
// заменить порог usdtd 7,6 на другой индикатор/порог во всех правилах
const swapUsdtd = (S, ind, op, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((x) => (x.ind === 'usdtd' && x.v === 7.6 ? { ind, op, v } : x)) })) });
function episodes(X, g, U = 7.6) {
  const n = X.n, I = X.ind, fe = (i) => I.fng[i] < 52 && I.usdtd[i] < U;
  const fepn = new Float64Array(n).fill(NaN), fepd = new Float64Array(n).fill(NaN), fepc = new Float64Array(n).fill(NaN), fepb = new Float64Array(n).fill(NaN), frem = new Float64Array(n).fill(NaN);
  let st = -1, last = -1e9, k = 0, rem = 1;
  for (let i = 0; i < n; i++) {
    if (fe(i)) { if (i - last > g + 1 || st < 0) { st = i; k = 0; rem = 1; } k++; last = i; rem *= I.fng[i] < 40 ? 0.7 : 0.84; }
    if (st >= 0 && i - last <= g) { fepn[i] = k; fepd[i] = i - st; fepc[i] = (X.c[i] / X.c[st] - 1) * 100; const b = I.btcp; fepb[i] = b && b[st] > 0 ? (b[i] / b[st] - 1) * 100 : NaN; frem[i] = rem; }
  }
  return { fepn, fepd, fepc, fepb, frem };
}
function addEp(G, g, U = 7.6) {
  const sfx = g + (U === 7.6 ? '' : 'u' + U);
  for (const k in G) for (const X of G[k]) { if (X.ind['fepn' + sfx]) continue; const o = episodes(X, g, U); for (const key in o) X.ind[key + sfx] = o[key]; }
}
function load(list = ['sel', 'ex', 'rnd', 'n100']) { const G = K.groups(list); K.prep(G); return G; }
const ev = (G, S, withM = true) => K.ev(G, S, withM);
// строка сравнения: доход к основе, строгая, группы, 100 новых, лучше/хуже, метрики
function row(tag, r, b) {
  const [bt, wr] = r.n100 ? K.bw(r, b, 'n100') : [0, 0];
  return `${(K.d(r, b) >= 0 ? '+' : '') + K.d(r, b).toFixed(3)} ${K.passes(r, b) ? '✔' : '·'} | ${K.line(r)} | 100н ${r.n100 ? r.n100.med.toFixed(0) + '/' + r.n100.pos + '/' + r.n100.hpos + ' +' + bt + '/−' + wr : '-'} | верш ${r.m.sellToTop.toFixed(1)}/${r.m.missedTops.toFixed(1)} дно ${r.m.zone15.toFixed(1)}/${r.m.bott3.toFixed(0)} | ${tag}${K.passes(r, b) ? '' : ' [' + K.why(r, b) + ']'}`;
}
// «пользовательский» критерий брифа: не хуже по монетам в плюсе, половинам в плюсе, худшей половине, худшей монете на всех трёх группах
const userOk = (r, b) => ['sel', 'ex', 'rnd'].every((k) => r[k].pos >= b[k].pos && r[k].hpos >= b[k].hpos && r[k].hworst >= b[k].hworst - 1e-9 && r[k].worst >= b[k].worst - 1e-9);
function runner(G, base, out) {
  return (tag, S) => { const r = ev(G, S); const ok = userOk(r, base); console.log((ok ? 'OK ' : '   ') + row(tag, r, base)); out.push({ tag, d: K.d(r, base), ok, strict: K.passes(r, base), why: K.why(r, base), sel: r.sel, ex: r.ex, rnd: { ...r.rnd, e: undefined }, n100: { ...r.n100, e: undefined }, bw: K.bw(r, base, 'n100'), m: r.m }); return r; };
}
module.exports = { K, c, BEST, BASE, isFear, mod, swapUsdtd, episodes, addEp, load, ev, row, userOk, runner };
