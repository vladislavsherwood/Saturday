/* hv, круг 0: сделки стратегии по одной монете (сдвиг 0): день, правило (номер в списке 1…N), сумма, цена, признаки, кэш/монеты на конец дня.
   node hv_d2.js PUMP [2026-01-01] [файл-кандидат.js — модуль, экспортирующий { S, pol }] */
const H = require('./hv_lib.js'), { P, BY } = H;
const nm = process.argv[2] || 'PUMP', from = process.argv[3] || '2026-01-01';
const C = process.argv[4] ? require(require('path').resolve(process.argv[4])) : { S: H.S5, pol: H.polW };
const X = BY[nm], S = C.S, log = [];
const pol = { ...C.pol, trace: [], wick: { ...C.pol.wick, log } };
const { tr } = P.edge(X, S, 0, 'full', true, pol);
const t0 = H.T(from), I = X.ind, T = pol.trace;
const st = (i) => { const r = T.find((x) => x[0] === i); return r ? `кэш $${Math.round(r[1])} монеты $${Math.round(r[2] * X.c[i])}` : ''; };
const ev = [];
for (const t of tr) if (I.t[t.i] >= t0) ev.push([t.i, `${t.s > 0 ? 'КУП ' : 'ПРОД'} пр.${t.q + 1} $${Math.round(t.amt)} по ${X.c[t.i].toPrecision(3)} | hvv ${Math.round(I.hvv[t.i - 1])} up90 ${Math.round(I.up90[t.i - 1])} ddm90 ${Math.round(I.ddm90[t.i - 1])} fng ${Math.round(I.fng[t.i - 1])} btcr30 ${Math.round(I.btcr30[t.i - 1])}`]);
for (const [, i, k, amt, lim] of log) if (I.t[i] >= t0) ev.push([i, `ФИТИЛЬ −${Math.round(k * 100)}% $${Math.round(amt)} по ${lim.toPrecision(3)}`]);
ev.sort((a, b) => a[0] - b[0]);
for (const [i, s] of ev) console.log(`${H.day(I.t[i])} ${s} | ${st(i)}`);
console.log('итог к DCA (сдвиг 0)', P.edge(X, S, 0, 'full', false, C.pol).e.toFixed(1), '% | последний день', H.day(I.t[X.n - 1]), X.c[X.n - 1], '|', st(X.n - 1));
