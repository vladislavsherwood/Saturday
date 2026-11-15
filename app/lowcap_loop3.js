/* Агент «ЛОУКАП», круг 3: «ножи» 2025–26 — режим рынка лоукапов, а не признак монеты.
   Индекс лоукапов lci — равновесный (средний дневной лог-доход монет ОТБОРА лоукапов, есть ≥ 5 монет), только прошлое; признаки по дню:
   lci200 — индекс к его средней 200 дн; lci90 — доход индекса за 90 дн, %; lcidd — просадка индекса от 365-дн. максимума, %; lcbr — доля монет отбора выше своей средней 50 дн, %.
   (A) Дни паники основы на отборе лоукапов: корзины режима → доходность монеты через 90/180 дней и доля «ножей» (−50% за 120 дн).
   (B) Правила: лоукап (доля < 1 б.п.) и плохой режим → паника только взносом / доли паники ×0,5; продажи на страхе ×k.
   Запуск: node app/lowcap_loop3.js */
const L = require('./lowcap_sim.js'), K = L.K, { c } = L;
const G = L.load(), S0 = L.S0;
// ---------- индекс лоукапов по отбору ----------
const ret = new Map();
for (const X of G.lsel) for (let i = 1; i < X.n; i++) { const r = Math.log(X.c[i] / X.c[i - 1]); if (!isFinite(r) || Math.abs(r) > 2) continue; const t = X.t[i]; if (!ret.has(t)) ret.set(t, []); ret.get(t).push(r); }
const days = [...ret.keys()].sort((a, b) => a - b).filter((t) => ret.get(t).length >= 5);
const IDX = new Map(); { let v = 0; for (const t of days) { const a = ret.get(t); v += a.reduce((s, x) => s + x, 0) / a.length; IDX.set(t, Math.exp(v)); } }
const BR = new Map(); { const ab = new Map(); for (const X of G.lsel) { const m = L.rollMean(X.c, 50); for (let i = 49; i < X.n; i++) { const t = X.t[i]; if (!ab.has(t)) ab.set(t, [0, 0]); ab.get(t)[0] += X.c[i] > m[i] ? 1 : 0; ab.get(t)[1]++; } } for (const [t, [a, n]] of ab) if (n >= 5) BR.set(t, (100 * a) / n); }
const T0 = days[0];
console.log('индекс лоукапов: с', L.dstr(T0), 'дней', days.length, '; монет в день: медиана', L.med(days.map((t) => ret.get(t).length)));
function lciFeatures(X) {
  const n = X.n, I = X.ind, v = new Float64Array(n); for (let i = 0; i < n; i++) { const x = IDX.get(X.t[i]); v[i] = x == null ? NaN : x; }
  const m200 = L.rollMean(v, 200, 0.9), mx = L.rollMaxN(v, 365);
  I.lci200 = Float64Array.from(v, (x, i) => x / m200[i]);
  I.lci90 = Float64Array.from(v, (x, i) => (i >= 90 && !isNaN(v[i - 90]) ? (x / v[i - 90] - 1) * 100 : NaN));
  I.lcidd = Float64Array.from(v, (x, i) => (1 - x / mx[i]) * 100);
  I.lcbr = Float64Array.from(X.t, (t) => (BR.has(t) ? BR.get(t) : NaN));
}
for (const g in G) for (const X of G[g]) lciFeatures(X);
// ---------- (A) дни паники ----------
const pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
function panicDays(A) { const o = []; for (const X of A) { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])), tr = K.edge(X, S0, 0, 'full', true).tr;
  for (const t of tr) if (t.s > 0 && L.isPanic(R[t.q])) { let mn = Infinity; for (let j = t.i; j < Math.min(X.n, t.i + 120); j++) mn = Math.min(mn, X.c[j]); o.push({ X, i: t.i, amt: t.amt, knife: mn < 0.5 * X.c[t.i] }); } } return o; }
const PD = panicDays(G.lsel), PS = panicDays([...G.sel, ...G.ex, ...G.rnd]);
function bucket(name, P, f, edges) {
  console.log(`  ${name}`);
  for (let q = 0; q < edges.length - 1; q++) { const B = P.filter((d) => { const v = f(d.X, d.i); return v >= edges[q] && v < edges[q + 1]; }); if (!B.length) continue;
    const w = (E, h) => { let s = 0, k = 0; for (const d of E) if (d.i + h < d.X.n) { s += d.amt * (d.X.c[d.i + h] / d.X.c[d.i] - 1); k += d.amt; } return k ? s / k : NaN; };
    const pre = B.filter((d) => d.X.t[d.i] < L.SPLIT), post = B.filter((d) => d.X.t[d.i] >= L.SPLIT), kn = (E) => (E.length ? (100 * E.filter((d) => d.knife).length / E.length).toFixed(0).padStart(3) : '  -');
    console.log(`    ${String(edges[q]).padStart(5)}…${String(edges[q + 1]).padEnd(5)} дней ${String(B.length).padStart(5)} (до/после ${pre.length}/${post.length}) | 90д деньги: до ${pct(w(pre, 90))} после ${pct(w(post, 90))} | 180д: до ${pct(w(pre, 180))} после ${pct(w(post, 180))} | ножей до ${kn(pre)}% после ${kn(post)}%`); }
}
console.log('\n(A) Дни паники, отбор лоукапов:');
bucket('индекс лоукапов к средней 200 (lci200)', PD, (X, i) => X.ind.lci200[i], [0, 0.6, 0.8, 1, 1.2, 9]);
bucket('доход индекса за 90 дн, % (lci90)', PD, (X, i) => X.ind.lci90[i], [-100, -50, -30, -10, 10, 1e9]);
bucket('просадка индекса от 365-дн. максимума, % (lcidd)', PD, (X, i) => X.ind.lcidd[i], [0, 30, 50, 70, 101]);
bucket('доля лоукапов выше средней 50, % (lcbr)', PD, (X, i) => X.ind.lcbr[i], [0, 10, 20, 35, 50, 101]);
bucket('доля альтов: изменение за 90 дн, п.п. (oth90)', PD, (X, i) => X.ind.oth90[i], [-100, -3, -1, 0, 1, 100]);
console.log('\n(A) Дни паники, стенд (отбор+экзамен+50 случ.), только с 2021-03 (есть индекс):');
bucket('индекс лоукапов к средней 200 (lci200)', PS, (X, i) => X.ind.lci200[i], [0, 0.6, 0.8, 1, 1.2, 9]);
bucket('доход индекса за 90 дн, % (lci90)', PS, (X, i) => X.ind.lci90[i], [-100, -50, -30, -10, 10, 1e9]);
// ---------- (B) правила ----------
const b = L.evs(G, S0);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} пол.${lo.hu}/${lo.hd} худш.пол ${lo.R.hworst.toFixed(0)} ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
console.log('\n(B) Правила (лоукап = доля в рынке за 90 дн < 1 б.п.). Основа: ЛОтбор', L.st(b.lsel).med.toFixed(0));
const LC = [c('mcsh90', '<', 1)];
const REG = { 'lci200<1': [c('lci200', '<', 1)], 'lci200<0.8': [c('lci200', '<', 0.8)], 'lci90<-30': [c('lci90', '<', -30)], 'lcbr<20': [c('lcbr', '<', 20)], 'всегда': [] };
for (const [rn, rc] of Object.entries(REG)) {
  show(`паника → взнос | лоукап, ${rn}`, L.pre(S0, L.isPanic, [...LC, ...rc], 1, { grp: 0 }));
  show(`паника доли ×0,5 | лоукап, ${rn}`, L.pre(S0, L.isPanic, [...LC, ...rc], (r) => 1 + (r.act - 1) * 0.5));
}
for (const [rn, rc] of Object.entries(REG)) for (const k of [1.5, 2]) show(`страх ×${k} | лоукап, ${rn}`, L.pre(S0, L.isFear, [...LC, ...rc], (r) => Math.max(-1, r.act * k)));
