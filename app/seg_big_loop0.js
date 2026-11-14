/* Круг 0. Основа (combo-best) на крупных монетах: окна истории, простой резерва, разбор продаж и возвратов, признаки поведения. */
const Z = require('./seg_big_sim.js'); const { K } = Z;
const G = Z.load(); const S = Z.BASE_S;
const RULE = (q) => q < 0 ? '—' : S.rules[q].conds.map((c) => c.ind + c.op + c.v).join('&');
const kind = (q) => { if (q < 0) return 'dca'; const r = S.rules[q], h = (i) => r.conds.some((c) => c.ind === i);
  if (r.act < 0) return h('qt') ? 'тихая' : h('oth90') ? 'шир.тихая' : h('up90') ? 'памп' : h('fund30') ? 'фандинг' : h('fng') && r.conds.some((c) => c.ind === 'fng' && c.v === 40) ? 'страх<40' : 'страх';
  return h('btcr30') ? 'разворот' : h('ago_qt') ? 'возврат' : 'паника/дно'; };
console.log('== Итог к DCA по окнам (худший из двух сдвигов), %');
const ks = new Set(); const T = {};
for (const X of Z.bigOf(G)) { T[X.name] = {}; for (const w of Z.windows(X)) { T[X.name][w.k] = Z.Ew(X, S, w.a, w.b); ks.add(w.k); } }
const order = ['full', 'h1', 'h2', ...[...ks].filter((k) => k[0] === 'y').sort(), ...[...ks].filter((k) => k[0] === 's').sort()];
console.log('монета ' + order.join(' '));
for (const nm in T) console.log(nm.padEnd(4) + ' ' + order.map((k) => (T[nm][k] == null ? '·' : T[nm][k].toFixed(0))).join(' '));
// прочие монеты: сколько календарных лет в минусе к DCA
let neg = 0, all = 0, negB = 0, allB = 0;
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) for (const w of Z.windows(X)) if (w.k[0] === 'y') { const e = Z.Ew(X, S, w.a, w.b); if (Z.BIG.includes(X.name)) { allB++; if (e < 0) negB++; } else { all++; if (e < 0) neg++; } }
console.log(`календарных лет хуже DCA: крупные ${negB}/${allB}, остальные 72 монеты ${neg}/${all}`);
console.log('\n== Простой резерва (доля кэша в стоимости, среднее по дням), сделки по типам');
for (const X of Z.bigOf(G)) {
  const { fr, qs } = Z.cashPath(X, S); let m = 0, hi = 0; for (let i = 0; i < X.n; i++) { m += fr[i]; if (fr[i] > 0.5) hi++; }
  // доля кэша в бычьих фазах: монета выше своей sma200 и BTC < 20% от максимума
  let bull = 0, bullc = 0; for (let i = 0; i < X.n; i++) if (X.ind.sma200[i] > 1 && X.ind.btcath[i] < 20) { bull++; bullc += fr[i]; }
  const tr = K.edge(X, S, 0, 'full', true).tr; const by = {};
  for (const t of tr) { const k = kind(t.q); by[k] = by[k] || { n: 0, amt: 0, up60: 0, up180: 0 }; by[k].n++; by[k].amt += t.amt;
    if (t.s < 0) { const p60 = X.c[Math.min(X.n - 1, t.i + 60)], p180 = X.c[Math.min(X.n - 1, t.i + 180)]; by[k].up60 += t.amt * (p60 / t.p - 1); by[k].up180 += t.amt * (p180 / t.p - 1); } }
  console.log(`${X.name}: кэш в среднем ${(100 * m / X.n).toFixed(0)}%, дней с кэшем > 50% ${(100 * hi / X.n).toFixed(0)}%, в бычьей фазе (монета > sma200, BTC < 20% от макс.) кэш ${(100 * bullc / Math.max(1, bull)).toFixed(0)}% (${bull} дн)`);
  console.log('   ' + Object.entries(by).map(([k, v]) => `${k} ${v.n}${v.up60 ? ` (цена через 60/180 дн ${(100 * v.up60 / v.amt).toFixed(0)}/${(100 * v.up180 / v.amt).toFixed(0)}%)` : ''}`).join('; '));
}
console.log('\n== Признаки поведения (медианы по дням): vol180, beta180, corr180, возраст на конец');
const feat = (X) => { const v = [], b = [], c = []; for (let i = 200; i < X.n; i++) { if (!isNaN(X.ind.vol180[i])) v.push(X.ind.vol180[i]); if (!isNaN(X.ind.beta180[i])) b.push(X.ind.beta180[i]); if (!isNaN(X.ind.corr180[i])) c.push(X.ind.corr180[i]); } return [K.med(v), K.med(b), K.med(c)]; };
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) { const [v, b, c] = feat(X); console.log(`${g} ${X.name.padEnd(9)} ${Z.BIG.includes(X.name) ? 'BIG' : '   '} vol ${v.toFixed(0)} beta ${b.toFixed(2)} corr ${c.toFixed(2)} n ${X.n}`); }
