/* Агент «ЛОУКАП», круг 5: повторные пампы и их затухание; ступенчатая продажа по обороту.
   Событие V (круг 2): оборот дня > 100% капитализации и монета > +100% от 90-дн. минимума (пауза 30 дней).
   (A) Номер пампа у монеты (1-й, 2-й, 3-й+), «нижняя вершина» (цена ниже прошлого V), «затухание оборота» (пиковый оборот ниже прошлого V),
       возраст на пампе → доходность сверх лоукапов того же дня через 30/90/180 дней, до/после 2025-06.
   (B) Правило: V основное (перед F, 20%) + повторный памп (был V за 365 дней) — продать k×; ступени по обороту 50/100/200%.
   Запуск: node app/lowcap_loop5.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0;
const H = [30, 90, 180], pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
const xs = {}; for (const h of H) { const m = new Map(); for (const X of G.lsel) for (let i = 0; i + h < X.n; i++) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(X.c[i + h] / X.c[i] - 1); } xs[h] = new Map([...m].map(([t, v]) => [t, L.med(v)])); }
const exr = (X, i, h) => (i + h < X.n && xs[h].has(X.t[i]) ? (X.c[i + h] / X.c[i]) / (1 + xs[h].get(X.t[i])) - 1 : NaN);
// индикаторы повторного пампа (только прошлое): vcnt365 — сколько V-дней (первых в эпизоде) было за 365 дн до сегодняшнего; vlast — дней с прошлого V
function vFeatures(X) {
  const I = X.ind, n = X.n, on = (i) => I.turn[i] > 100 && I.up90[i] > 100, cnt = new Float64Array(n), last = new Float64Array(n), prevP = new Float64Array(n), prevT = new Float64Array(n);
  const ev = []; let lastI = -1e9;
  for (let i = 0; i < n; i++) {
    let k = 0; for (const e of ev) if (i - e.i <= 365 && e.i < i) k++;
    cnt[i] = k; last[i] = ev.length ? i - ev[ev.length - 1].i : 1e9; prevP[i] = ev.length ? ev[ev.length - 1].p : NaN; prevT[i] = ev.length ? ev[ev.length - 1].tm : NaN;
    if (on(i) && i - lastI >= 30) { lastI = i; let tm = 0, pm = 0; for (let j = i; j < Math.min(n, i + 7); j++) { tm = Math.max(tm, I.turn[j] || 0); pm = Math.max(pm, X.c[j]); } ev.push({ i, p: pm, tm }); }
  }
  I.vcnt365 = cnt; I.vlast = last; I.vprevp = prevP; I.vprevt = prevT;
}
for (const g in G) for (const X of G[g]) vFeatures(X);
console.log('(A) События V на отборе лоукапов: эпизодов | сверх лоукапов дня через 30/90/180 дн (доля вниз через 90) | до 06.2025 / после');
const groups = { '1-й V у монеты': (X, i) => X.ind.vcnt365[i] === 0 && X.ind.vlast[i] > 1e8, 'повторный (был V за 365 дн)': (X, i) => X.ind.vcnt365[i] >= 1, '3-й и далее (≥2 V за 365 дн)': (X, i) => X.ind.vcnt365[i] >= 2,
  'нижняя вершина (цена < прошлого V)': (X, i) => X.ind.vcnt365[i] >= 1 && X.c[i] < X.ind.vprevp[i], 'выше прошлого V': (X, i) => X.ind.vcnt365[i] >= 1 && X.c[i] >= X.ind.vprevp[i],
  'оборот ниже прошлого пика V': (X, i) => X.ind.vcnt365[i] >= 1 && X.ind.turn[i] < X.ind.vprevt[i], 'молодой (возраст < 120 дн)': (X, i) => X.ind.agel[i] < 120, 'возраст ≥ 120 дн': (X, i) => X.ind.agel[i] >= 120 };
for (const [nm, f] of Object.entries(groups)) {
  const P = { pre: [], post: [] }, coins = new Set();
  for (const X of G.lsel) { let last = -1e9; for (let i = 0; i < X.n; i++) if (X.ind.turn[i] > 100 && X.ind.up90[i] > 100 && i - last >= 30) { last = i; if (!f(X, i)) continue; coins.add(X.name); P[X.t[i] < L.SPLIT ? 'pre' : 'post'].push(H.map((h) => exr(X, i, h))); } }
  const s = (A) => `${A.length} эп. ${H.map((h, q) => pct(L.med(A.map((x) => x[q]).filter((v) => !isNaN(v))))).join(' ')} (${(100 * A.filter((x) => x[1] < 0).length / Math.max(1, A.filter((x) => !isNaN(x[1])).length)).toFixed(0)}%)`;
  console.log(`  ${nm.padEnd(36)} монет ${String(coins.size).padStart(3)} | ${s([...P.pre, ...P.post])} | ${s(P.pre)} / ${s(P.post)}`);
}
// (B) правила
const b = L.evs(G, S0), iF = S0.rules.findIndex(L.isPump);
const show = (tag, S) => { const r = L.evs(G, S), lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b); console.log(`${tag}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} [${lo.R.pos}/${lo.R.hpos}/${lo.R.hworst.toFixed(0)}] ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} [${['sel', 'ex', 'rnd', 'n100'].map((g) => sd.R[g].med.toFixed(0) + '/' + sd.R[g].hworst.toFixed(0)).join(' ')}] 100н ${L.bw(r, b, 'n100').join('/')}`); return r; };
const LC = c('mcsh90', '<', 1), V = (s, extra = [], T = 100) => ({ act: -s, conds: [LC, c('turn', '>', T), c('up90', '>', 100), ...extra] });
console.log('\n(B) Правила');
const SV = L.addRule(S0, V(0.2), iF); show('V (20%)', SV);
for (const k of [0.3, 0.4, 0.5]) show(`V + повторный памп (vcnt365 ≥ 1) → ${k * 100}%`, L.addRule(SV, V(k, [c('vcnt365', '>', 0.5)]), iF));
for (const k of [0.3, 0.5]) show(`V + нижняя вершина → ${k * 100}%`, L.addRule(SV, { ...V(k, [c('vcnt365', '>', 0.5)]), conds: [...V(k).conds, c('vcnt365', '>', 0.5)] }, iF));
for (const k of [0.1, 0.05]) show(`V + 1-й памп → только ${k * 100}%`, L.addRule(SV, V(k, [c('vcnt365', '<', 0.5)]), iF));
show('ступени: оборот > 50% → 10%, > 100% → 20%', L.addRule(SV, V(0.1, [], 50), iF + 1));
show('ступени: > 100% → 20%, > 200% → 40%', L.addRule(SV, V(0.4, [], 200), iF));
show('V молодой монеты (< 120 дн) → 40%', L.addRule(SV, V(0.4, [c('agel', '<', 120)]), iF));
