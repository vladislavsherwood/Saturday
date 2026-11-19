/* dcaf: сделки «ловушки для фитилей» — где и когда срабатывали (проверка на битые минимумы Yahoo). Запуск: node dcaf_r5.js */
const L = require('./r4_lib.js'), { S0, P, G } = L;
const log = [];
const pol = { ...L.pol0, wick: { lv: [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]], age: 60, log } };
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) P.edge(X, S0, 0, 'full', false, pol);
const day = (X, i) => L.day(X.ind.t[i]);
const by = {};
for (const [nm, i, k, amt, lim, cl] of log) { const key = nm + ' ' + i; (by[key] = by[key] || { nm, i, ks: [], amt: 0, lim, cl }).ks.push(k); by[key].amt += amt; by[key].lim = lim; }
const ev = Object.values(by);
const XS = {}; for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) XS[X.name] = X;
console.log('событий (монета-день):', ev.length, ' по глубине:', [0.25, 0.4, 0.6].map((k) => k + ':' + log.filter((e) => e[2] === k).length).join(' '));
const rows = ev.map((e) => { const X = XS[e.nm], i = e.i; return { ...e, d: day(X, i), prev: X.c[i - 1], lo: X.l[i], cl: X.c[i], nx: X.c[Math.min(X.n - 1, i + 1)], c30: X.c[Math.min(X.n - 1, i + 30)] }; });
rows.sort((a, b) => a.d < b.d ? -1 : 1);
const byDay = {}; for (const r of rows) (byDay[r.d] = byDay[r.d] || []).push(r.nm);
console.log('дни с ≥ 3 монетами:'); for (const [d, a] of Object.entries(byDay)) if (a.length >= 3) console.log(' ', d, a.length, a.slice(0, 12).join(','));
console.log('все события: дата монета | вчера → мин / закр / завтра / +30д (в % ко вчера)');
for (const r of rows) { const p = (v) => ((v / r.prev - 1) * 100).toFixed(0).padStart(5); console.log(`${r.d} ${r.nm.padEnd(18)} ${p(r.lo)} ${p(r.cl)} ${p(r.nx)} ${p(r.c30)}  уровни ${r.ks.join(',')}`); }
