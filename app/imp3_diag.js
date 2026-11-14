/* imp3, круг 0 (разбор): продажи на страхе основы по дню эпизода, падению монеты от начала эпизода, направлению страха; эпизоды BTC.
   Будущие цены — только для оценки. Запуск: node app/imp3_diag.js */
const Z = require('./imp3_sim.js');
const { K } = Z;
const t0 = Date.now();
const G = Z.load(['sel', 'ex', 'rnd']);
Z.addEp(G, 14);
console.log('загрузка', ((Date.now() - t0) / 1000).toFixed(1), 'с');
const t1 = Date.now(); const rb = Z.ev(G, Z.BASE); console.log('оценка основы', ((Date.now() - t1) / 1000).toFixed(1), 'с'); console.log(K.line(rb), K.fmtM(rb.m));
const firstRule = (X, j) => Z.BASE.rules.findIndex((r) => r.conds.every((cd) => X.ind[cd.ind]) && r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; }));
const A = [...G.sel, ...G.ex, ...G.rnd];
const bk = (v, edges) => { for (let q = 0; q < edges.length; q++) if (v < edges[q]) return q; return edges.length; };
const tabs = { fepn: [4, 11, 21, 41, 81], fepc: [-40, -25, -10, 0, 15], fepd: [15, 45, 90, 180], dfng: [-10, -3, 3, 10] };
const T = {}; for (const k in tabs) T[k] = Array.from({ length: tabs[k].length + 1 }, () => ({ amt: 0, n: 0, f60: 0, f180: 0, mn: 0 }));
let tot = 0, totFear = 0;
for (const X of A) {
  const { tr } = K.edge(X, Z.BASE, 0, 'full', true); const c = X.c, I = X.ind;
  for (const t of tr) { if (t.s !== -1) continue; tot += t.amt; const j = t.i - 1, q = firstRule(X, j); if (q < 0 || !Z.isFear(Z.BASE.rules[q])) continue; totFear += t.amt;
    const i60 = Math.min(X.n - 1, t.i + 60), i180 = Math.min(X.n - 1, t.i + 180); let mn = Infinity; for (let u = t.i; u <= i180; u++) mn = Math.min(mn, c[u]);
    const dfng = j >= 7 ? I.fng[j] - I.fng[j - 7] : 0;
    const vals = { fepn: I.fepn14[j], fepc: I.fepc14[j], fepd: I.fepd14[j], dfng };
    for (const k in tabs) { const b = T[k][bk(vals[k], tabs[k])]; b.amt += t.amt; b.n++; b.f60 += t.amt * Math.log(c[i60] / t.p); b.f180 += t.amt * Math.log(c[i180] / t.p); b.mn += t.amt * Math.log(mn / t.p); }
  }
}
console.log(`\nпродажи на страхе: ${(100 * totFear / tot).toFixed(0)}% денег продаж (отбор+экзамен+50 случ.)`);
console.log('корзина | доля денег страха | продаж | цена через 60 / 180 дн к цене продажи (средн. по деньгам) | минимум 180 дн к цене');
for (const k in tabs) { console.log('-- ' + k + ' (границы ' + tabs[k].join(', ') + ')'); T[k].forEach((b, q) => console.log(`  ${q}: ${(100 * b.amt / totFear).toFixed(1)}% | ${b.n} | ${(100 * (Math.exp(b.f60 / b.amt) - 1)).toFixed(1)}% / ${(100 * (Math.exp(b.f180 / b.amt) - 1)).toFixed(1)}% | ${(100 * (Math.exp(b.mn / b.amt) - 1)).toFixed(1)}%`)); }
// эпизоды страха по BTC
const B = G.sel.find((x) => x.name === 'BTC'); const d = (i) => new Date(B.t[i] * 86400000).toISOString().slice(0, 10);
const I = B.ind; let s = -1; const eps = [];
for (let i = 1; i < B.n; i++) { if (!isNaN(I.fepn14[i]) && (isNaN(I.fepn14[i - 1]) || I.fepd14[i] < I.fepd14[i - 1])) s = i; if (s >= 0 && (i === B.n - 1 || isNaN(I.fepn14[i + 1]) || I.fepd14[i + 1] < I.fepd14[i])) { let lo = Infinity, li = s; for (let u = s; u <= i; u++) if (B.c[u] < lo) { lo = B.c[u]; li = u; } eps.push(`${d(s)}→${d(i)} дней страха ${I.fepn14[i]} | BTC ${B.c[s].toFixed(0)}→${B.c[i].toFixed(0)}, мин ${lo.toFixed(0)} (${d(li)}, ${((lo / B.c[s] - 1) * 100).toFixed(0)}%) | через 90 дн после конца ${((B.c[Math.min(B.n - 1, i + 90)] / B.c[i] - 1) * 100).toFixed(0)}%`); s = -1; } }
console.log(`\nэпизоды страха BTC (разрыв ≤ 14 дн): ${eps.length}`); eps.forEach((x) => console.log('  ' + x));
