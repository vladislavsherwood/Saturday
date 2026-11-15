/* Агент «ЛОУКАП», круг 4: инфляция предложения (разлоки) — объяснение «ножей» на уровне монеты.
   supg90/supg180 — рост предложения в обращении (CMC) за 90/180 дней, % (только прошлое; первые дни без капитализации CMC — 0, оценка).
   (A) события: корзины supg180 → доходность сверх медианы лоукапов того же дня через 90/180 дней, до/после 2025-06;
   (B) дни паники основы: корзины supg180 → деньги через 90/180 дн и доля «ножей», до/после;
   (C) правила: лоукап и supg180 > X → паника только взносом / доли ×0,5; продажи на страхе ×k; разрешение только до/после 2025-06.
   Запуск: node app/lowcap_loop4.js */
const L = require('./lowcap_sim.js'), K = L.K, { c } = L;
const G = L.load(), S0 = L.S0;
function supFeatures(X) {
  const I = X.ind, n = X.n, sup = Float64Array.from(I.mc, (m, i) => m / X.c[i]);
  for (const w of [90, 180]) I['supg' + w] = Float64Array.from(sup, (s, i) => (i >= w && sup[i - w] > 0 ? (s / sup[i - w] - 1) * 100 : NaN));
}
for (const g in G) for (const X of G[g]) supFeatures(X);
const H = [90, 180], pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
const xs = {}; for (const h of H) { const m = new Map(); for (const X of G.lsel) for (let i = 0; i + h < X.n; i++) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(X.c[i + h] / X.c[i] - 1); } xs[h] = new Map([...m].map(([t, v]) => [t, L.med(v)])); }
const exr = (X, i, h) => (i + h < X.n && xs[h].has(X.t[i]) ? (X.c[i + h] / X.c[i]) / (1 + xs[h].get(X.t[i])) - 1 : NaN);
console.log('(A) Корзины роста предложения за 180 дн (каждый 30-й день монеты, отбор лоукапов): эпизодов | сверх лоукапов дня 90/180 дн (доля вниз) до | после');
const E180 = [-1e9, 0.5, 10, 25, 50, 100, 1e9];
for (let q = 0; q < E180.length - 1; q++) { const P = { pre: [], post: [] }; let coins = new Set();
  for (const X of G.lsel) for (let i = 0; i < X.n; i += 30) { const v = X.ind.supg180[i]; if (!(v >= E180[q] && v < E180[q + 1])) continue; coins.add(X.name); P[X.t[i] < L.SPLIT ? 'pre' : 'post'].push([exr(X, i, 90), exr(X, i, 180)]); }
  const f = (A) => `${A.length} эп. ${pct(L.med(A.map((x) => x[0]).filter((v) => !isNaN(v))))} / ${pct(L.med(A.map((x) => x[1]).filter((v) => !isNaN(v))))} (${(100 * A.filter((x) => x[0] < 0).length / Math.max(1, A.filter((x) => !isNaN(x[0])).length)).toFixed(0)}% вниз)`;
  console.log(`  supg180 ${String(E180[q]).padStart(6)}…${String(E180[q + 1]).padEnd(6)} монет ${String(coins.size).padStart(3)} | до: ${f(P.pre)} | после: ${f(P.post)}`); }
// (B) дни паники
function panicDays(A) { const o = []; for (const X of A) { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S0, 0, 'full', true).tr;
  for (const t of tr) if (t.s > 0 && L.isPanic(R[t.q])) { let mn = Infinity; for (let j = t.i; j < Math.min(X.n, t.i + 120); j++) mn = Math.min(mn, X.c[j]); o.push({ X, i: t.i, amt: t.amt, knife: mn < 0.5 * X.c[t.i] }); } } return o; }
function bucket(name, P, f, edges) {
  console.log(`  ${name}`);
  for (let q = 0; q < edges.length - 1; q++) { const B = P.filter((d) => { const v = f(d.X, d.i); return v >= edges[q] && v < edges[q + 1]; }); if (!B.length) continue;
    const w = (E, h) => { let s = 0, k = 0; for (const d of E) if (d.i + h < d.X.n) { s += d.amt * (d.X.c[d.i + h] / d.X.c[d.i] - 1); k += d.amt; } return k ? s / k : NaN; };
    const pre = B.filter((d) => d.X.t[d.i] < L.SPLIT), post = B.filter((d) => d.X.t[d.i] >= L.SPLIT), kn = (E) => (E.length ? (100 * E.filter((d) => d.knife).length / E.length).toFixed(0).padStart(3) : '  -');
    const ex = (E) => pct(L.med(E.map((d) => exr(d.X, d.i, 90)).filter((v) => !isNaN(v))));
    console.log(`    ${String(edges[q]).padStart(6)}…${String(edges[q + 1]).padEnd(6)} дней ${String(B.length).padStart(5)} (до/после ${pre.length}/${post.length}) | 90д деньги до ${pct(w(pre, 90))} после ${pct(w(post, 90))} | сверх лоукапов 90д до ${ex(pre)} после ${ex(post)} | ножей до ${kn(pre)}% после ${kn(post)}%`); }
}
console.log('\n(B) Дни паники, отбор лоукапов');
const PD = panicDays(G.lsel);
bucket('рост предложения за 180 дн, %', PD, (X, i) => X.ind.supg180[i], E180);
bucket('рост предложения за 90 дн, %', PD, (X, i) => X.ind.supg90[i], [-1e9, 0.5, 5, 15, 30, 1e9]);
console.log('\n(B) Дни паники, стенд (отбор+экзамен+50 случ.)');
bucket('рост предложения за 180 дн, %', panicDays([...G.sel, ...G.ex, ...G.rnd]), (X, i) => X.ind.supg180[i], E180);
// (C) правила
const b = L.evs(G, S0);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} [${lo.R.pos}/${lo.R.hpos}/${lo.R.hworst.toFixed(0)}] ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
console.log('\n(C) Правила');
for (const X of [25, 50, 100]) for (const fl of [[c('mcsh90', '<', 1)], []]) {
  const cd = [...fl, c('supg180', '>', X)], tag = `${fl.length ? 'лоукап' : 'все'}, supg180>${X}`;
  for (const [nm, f] of [['паника → взнос', (q) => L.pre(S0, L.isPanic, q, 1, { grp: 0 })], ['паника ×0,5', (q) => L.pre(S0, L.isPanic, q, (r) => 1 + (r.act - 1) * 0.5)]]) {
    show(`${nm} | ${tag} | всё время`, f(cd)); show(`${nm} | ${tag} | только до 06.2025`, f(L.onlyBefore(cd, '2025-06-01'))); show(`${nm} | ${tag} | только после`, f(L.onlyAfter(cd, '2025-06-01')));
  }
}
