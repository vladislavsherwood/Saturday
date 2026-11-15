/* imp1, круг 5. Разворот, зависящий от состояния резерва монеты (новая модель: условия на состояние, imp1_sim.edgeS).
   Гипотеза (заранее): H5a — «свежий» резерв (с последнего дня, когда резерв был весь вложен, прошло < N дней: продали недавно на страхе/вершине)
   + разворот = отскок внутри только начавшегося спада (2022-03, 2026-08) → покупать долю a (взнос/50%), а «отлежавшийся» резерв (≥ N дней,
   долгий медвежий рынок: 2019-04, 2023-10, 2024-02) — весь. H5b — большая доля резерва в капитале монеты (rs > R) → часть; обратные варианты
   для контроля. Критерий: доход > +0,05 на 2 соседних N (или R) и 2 долях, строгая ✔, «выше 90-дн. минимума» ниже.
   Сначала разбор: $rs и $age в дни разворота по эпизодам. Запуск: node app/imp1_loop5.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']);
const ALL = [...G.sel, ...G.ex, ...G.rnd];
const base = K.evS(G, K.S0), bm = K.buyMetric(ALL, K.S0);
const c = K.c;
// разбор: состояние в первый день покупки разворота по годам (взвешено деньгами)
{
  const E = {};
  for (const X of ALL) {
    const S = { ...K.S0, rules: K.S0.rules.map((r) => (K.isRev(r) && r.act > 1 ? { ...r, conds: [...r.conds, c('$rs', '>', -1)] } : r)) };
    // повтор edgeS с записью состояния
    const R = K.S0.rules; let cash = 0, units = 0, last0 = 0;
    for (let i = 0; i < X.n; i++) {
      const p = X.c[i], j = i - 1; const pj = j >= 0 ? X.c[j] : p, cap = cash + units * pj, rs = cap > 0 ? cash / cap : 0; if (rs < 0.05) last0 = i; const age = i - last0;
      let q = -2; if (j >= 0) { q = -1; for (let k = 0; k < R.length; k++) { const ok = R[k].conds.every((cd) => { const a = X.ind[cd.ind]; if (!a) return false; return cd.op === '<' ? a[j] < cd.v : a[j] > cd.v; }); if (ok) { q = k; break; } } }
      const before = cash, a = q >= 0 ? R[q].act : q === -2 ? 1 : K.S0.base; cash += 10;
      if (q >= 0 && K.isRev(R[q]) && a > 1 && before > 100) { const y = new Date(X.t[i] * 864e5).toISOString().slice(0, 7); const e = (E[y] = E[y] || { m: 0, rs: 0, age: 0, n: 0 }); e.m += before; e.rs += before * rs; e.age += before * age; e.n++; }
      if (a < 0) { const amt = -a * units * p; units -= amt / p; cash += amt * 0.999; } else if (a > 0) { const amt = Math.min(cash, 10 + (a - 1) * before); units += (amt * 0.999) / p; cash -= amt; }
    }
  }
  console.log('месяц | покупок | доля резерва (взвеш.) | возраст резерва, дн (взвеш.)');
  for (const y of Object.keys(E).sort()) if (E[y].m > 1e5) console.log(`${y} | ${E[y].n} | ${(E[y].rs / E[y].m).toFixed(2)} | ${(E[y].age / E[y].m).toFixed(0)}`);
}
console.log(`основа: ${K.line(base)} | выше мин90 ${bm.above.toFixed(1)}, в зоне ${bm.zone.toFixed(1)}`);
const V = (cs, a) => K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, ...cs] }, r]);
const L = [];
for (const N of [60, 120, 180, 270, 365]) { L.push([`возраст < ${N}`, [c('$age', '<', N)]]); L.push([`возраст > ${N}`, [c('$age', '>', N)]]); }
for (const R of [0.3, 0.5, 0.7]) { L.push([`доля резерва > ${R}`, [c('$rs', '>', R)]]); L.push([`доля резерва < ${R}`, [c('$rs', '<', R)]]); }
for (const [t, cs] of L) for (const a of [1, 1.5]) {
  const S = V(cs, a), r = K.evS(G, S), m = K.buyMetric(ALL, S);
  console.log(`${K.passes(r, base) ? '✔' : '·'} ${(K.inc(r) - K.inc(base)).toFixed(3)} | ${K.line(r)} | мин90 ${m.above.toFixed(1)} зона ${m.zone.toFixed(1)} | ${t} → ${a === 1 ? 'взнос' : '50%'}${K.passes(r, base) ? '' : '  ✘ ' + K.why(r, base)}`);
}
