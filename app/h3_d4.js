/* h3, диагностика 4: разворот BTC (правило 27) перед обвалом — сколько случаев и сколько стоят. Эпизод покупок R27 (разрыв > 10 дн).
   «Плохой» — монета в 60 дн после первой покупки падает ≥ 40% от цены покупки (минимум закрытий). Оракул-фильтр: R27 в дни плохих эпизодов → только взнос
   (знание будущего — потолок для любого фильтра); и наоборот — убрать хорошие. Официальная метрика к основе. */
const H = require('./h3_lib.js'), { L, P, G, c } = H;
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol = H.base(KEY);
const S = H.cl(), R27 = S.rules[26];
L.addInd('h3n', (X) => new Float64Array(X.n));
const Sn = H.cl(); Sn.rules.splice(26, 0, { act: 1, conds: [c('h3n', '>', 0.5), c('btcr30', '>', 20)] });
const eps = [];
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) {
  const Rc = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), pp = { ...pol, trace: [] };
  const { tr } = P.edge(X, S, 0, 'full', true, pp); let cur = null;
  for (const t of tr) { if (!(t.s > 0 && Rc[t.q] === R27)) continue; const V = pp.trace[t.i][1] + pp.trace[t.i][2] * X.c[t.i];
    if (!cur || t.i - cur.last > 10) { cur = { g, nm: X.name, i0: t.i, last: t.i, amt: 0, V, p: t.p }; eps.push(cur); } cur.amt += t.amt; cur.last = t.i; }
}
for (const e of eps) { const X = G[e.g].find((x) => x.name === e.nm); let m = Infinity; for (let k = e.i0; k < Math.min(X.n, e.i0 + 60); k++) m = Math.min(m, X.c[k]); e.dd = 1 - m / e.p; e.bad = e.dd >= 0.4; e.sh = e.amt / e.V; e.d = L.day(X.ind.t[e.i0]); }
const byY = {}; for (const e of eps) { const y = e.d.slice(0, 7); (byY[y] = byY[y] || { n: 0, bad: 0, sh: 0 }); byY[y].n++; if (e.bad) byY[y].bad++; }
const E81 = eps.filter((e) => e.g !== 'n100');
console.log(`эпизодов R27: ${eps.length} (81: ${E81.length}); плохих (−40% за 60 дн): ${eps.filter((e) => e.bad).length} (81: ${E81.filter((e) => e.bad).length}); доля капитала в плохих покупках — медиана ${(E81.filter((e) => e.bad).map((e) => e.sh).sort((a, b) => a - b)[E81.filter((e) => e.bad).length >> 1] * 100).toFixed(0)}%`);
console.log('по месяцам начала (эпизодов / плохих):', Object.entries(byY).filter(([, v]) => v.n >= 5 || v.bad >= 2).map(([k, v]) => `${k} ${v.n}/${v.bad}`).join(', '));
console.log('плохие на 81 монете:', E81.filter((e) => e.bad).map((e) => `${e.nm} ${e.d} ${(e.sh * 100).toFixed(0)}% −${(e.dd * 100).toFixed(0)}%`).join('; '));
const setN = (sel) => { for (const g in G) for (const X of G[g]) X.ind.h3n.fill(0); for (const e of eps) if (sel(e)) { const X = G[e.g].find((x) => x.name === e.nm); for (let k = e.i0 - 1; k <= e.last + 1; k++) if (k >= 0) X.ind.h3n[k] = 1; } };
setN((e) => e.bad); L.run('оракул: R27 → взнос в плохих эпизодах', Sn, pol, { n100: true });
setN((e) => !e.bad); L.run('оракул: R27 → взнос в хороших эпизодах', Sn, pol, { n100: true });
setN(() => true); L.run('без R27 вообще (через блок)', Sn, pol, { n100: true });
