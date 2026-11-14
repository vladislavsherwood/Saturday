/* Агент ТА, круг 1: разбор, где правила основы (combo-best: F + C1.25 + C6) ошибаются, и какие признаки ТА отделяют удачные сделки от неудачных.
   Гипотеза (заранее): (а) панические покупки, сделанные, пока BTC ещё в верхней части цикла (выше 50-недельной средней, недельный RSI > 50),
   дальше от дна, чем сделанные ниже; (б) продажи на страхе, сделанные, когда монета уже перепродана (RSI < 30, ниже нижней полосы Боллинджера),
   продают местный минимум; (в) ложные развороты «BTC +20% за 30 дней» случаются ниже 200-дн./50-нед. средней BTC.
   Критерий отбора признака в следующие круги: разница качества сделок между крайними третями признака ≥ 10 п.п. (по деньгам) и тот же знак
   в обеих половинах истории (до 2022 и с 2022).
   Качество покупки: цена / минимум следующих 90 дней − 1 (меньше — лучше) и доходность через 180 дней; продажи: цена / максимум ±90 дней
   (больше — лучше) и доходность через 90 дней после продажи (меньше — лучше). 81 монета (отбор + экзамен + 50 случайных).
   Запуск: node app/ta_loop1.js */
const T = require('./ta_sim.js');
const S0 = T.S0;
const G = T.load(['sel', 'ex', 'rnd']);
const A = [...G.sel, ...G.ex, ...G.rnd];
const S = T.BASE;
const D2022 = 18993; // 2022-01-01 в днях
const FEAT = ['t_rsi', 't_bbz', 't_wrsi', 't_w20', 't_w50', 't_don90', 't_fib', 't_atrp', 't_bbwp', 't_macdh', 't_wick', 'vol', 't_hl', 't_hh', 'sma200', 'sma50',
  'b_rsi', 'b_wrsi', 'b_w20', 'b_w50', 'b_w200', 'b_bbz', 'b_macdh', 'b_don90', 'b_hl', 'b_hh', 'b_vol', 'b_bbwp', 'b_atrp'];
const cls = (r) => (T.isPanic(r) ? 'паника' : T.isRev(r) ? 'разворот' : r.act > 1 ? 'другие покупки' : T.isFearSell(r) ? 'страх' : r.act < 0 ? 'другие продажи' : '-');
const B = [], Sl = [];
for (const X of A) {
  const M = S0.metrics ? null : null; // метрики считаем сами
  const idx = S.rules.map((r, i) => i).filter((i) => S.rules[i].conds.every((cd) => X.ind[cd.ind]));
  const { tr } = S0.edge(X, S, 0, 'full', true), c = X.c, n = X.n;
  for (const t of tr) {
    if (Math.abs(t.s) !== 1) continue;
    const r = S.rules[idx[t.q]], j = t.i - 1, f = {}; for (const k of FEAT) f[k] = X.ind[k] ? X.ind[k][j] : NaN;
    if (t.s > 0) { let mn = Infinity; for (let q = t.i; q <= Math.min(n - 1, t.i + 90); q++) mn = Math.min(mn, c[q]); const f180 = t.i + 180 < n ? c[t.i + 180] / t.p - 1 : NaN; B.push({ amt: t.amt, q: t.p / mn - 1, f180, f, cl: cls(r), late: X.t[t.i] >= D2022, name: X.name, day: X.t[t.i] }); }
    else { let mx = 0; for (let q = Math.max(0, t.i - 90); q <= Math.min(n - 1, t.i + 90); q++) mx = Math.max(mx, c[q]); const f90 = t.i + 90 < n ? c[t.i + 90] / t.p - 1 : NaN; Sl.push({ amt: t.amt, q: t.p / mx, f90, f, cl: cls(r), late: X.t[t.i] >= D2022, name: X.name, day: X.t[t.i] }); }
  }
}
const wavg = (L, g) => { let s = 0, w = 0; for (const x of L) { const v = g(x); if (!isNaN(v)) { s += x.amt * v; w += x.amt; } } return w ? s / w : NaN; };
const pc = (v) => (100 * v).toFixed(0);
function table(L, title, qn, fn) {
  console.log(`\n=== ${title}: ${L.length} сделок; по классам правил (доля денег / качество ${qn} / ${fn}):`);
  const tot = L.reduce((s, x) => s + x.amt, 0);
  for (const k of [...new Set(L.map((x) => x.cl))]) { const Q = L.filter((x) => x.cl === k); console.log(`  ${k}: ${pc(Q.reduce((s, x) => s + x.amt, 0) / tot)}% денег, ${pc(wavg(Q, (x) => x.q))} / ${pc(wavg(Q, (x) => x.fw))}`); }
  console.log(`  признак: [нижняя треть | средняя | верхняя треть] качество ${qn} (и ${fn}); разница; ранняя/поздняя половина истории`);
  const out = [];
  for (const k of FEAT) {
    const Q = L.filter((x) => !isNaN(x.f[k])); if (Q.length < L.length * 0.5) continue;
    const v = Q.map((x) => x.f[k]).sort((a, b) => a - b), a1 = v[Math.floor(v.length / 3)], a2 = v[Math.floor((2 * v.length) / 3)];
    const part = (P) => [P.filter((x) => x.f[k] <= a1), P.filter((x) => x.f[k] > a1 && x.f[k] <= a2), P.filter((x) => x.f[k] > a2)];
    const [lo, mid, hi] = part(Q), dq = wavg(hi, (x) => x.q) - wavg(lo, (x) => x.q);
    const e = part(Q.filter((x) => !x.late)), l = part(Q.filter((x) => x.late));
    const de = wavg(e[2], (x) => x.q) - wavg(e[0], (x) => x.q), dl = wavg(l[2], (x) => x.q) - wavg(l[0], (x) => x.q);
    out.push({ k, dq, s: `  ${k.padEnd(8)} пороги ${a1.toFixed(2)}/${a2.toFixed(2)}: ${pc(wavg(lo, (x) => x.q))} | ${pc(wavg(mid, (x) => x.q))} | ${pc(wavg(hi, (x) => x.q))}  (${pc(wavg(lo, (x) => x.fw))} | ${pc(wavg(mid, (x) => x.fw))} | ${pc(wavg(hi, (x) => x.fw))}); разница ${pc(dq)} п.п.; до 2022 ${pc(de)}, с 2022 ${pc(dl)}${Math.abs(dq) >= 0.1 && Math.sign(de) === Math.sign(dl) && Math.sign(de) === Math.sign(dq) ? '  ◆' : ''}` });
  }
  out.sort((a, b) => Math.abs(b.dq) - Math.abs(a.dq)); for (const o of out) console.log(o.s);
}
for (const x of B) x.fw = x.f180; for (const x of Sl) x.fw = x.f90;
table(B, 'ПОКУПКИ РЕЗЕРВА (все)', 'цена/мин90 вперёд −1', 'доходность через 180 дн');
table(B.filter((x) => x.cl === 'паника'), 'ПОКУПКИ: только паника', 'цена/мин90 вперёд −1', 'через 180 дн');
table(Sl, 'ПРОДАЖИ (все)', 'цена/макс ±90', 'доходность через 90 дн после продажи');
table(Sl.filter((x) => x.cl === 'страх'), 'ПРОДАЖИ: только страх', 'цена/макс ±90', 'через 90 дн');

// развороты BTC: эпизоды btcr30 > 15 (первый день после ≥ 30 дней без такого), максимум btcr30 в эпизоде, состояние ТА BTC в первый день > 17,5
const BT = T.btcTA(), X = S0.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC'), bc = X.c, r30 = X.ind.btcr30;
const d = (t) => new Date(t * 86400000).toISOString().slice(0, 10);
console.log('\n=== Эпизоды разворота BTC (btcr30 ≥ 17,5; первый день; максимум btcr30 за 30 дней; BTC через 90/180 дней; мин. через 180 дн) и ТА BTC в этот день:');
console.log('   дата        r30   макс  →90д  →180д  мин180 | rsi wrsi  w20  w50  w200 bbz  macdh don90 hl hh vol bbwp');
let last = -999;
for (let i = 30; i < X.n; i++) {
  if (r30[i] >= 17.5 && i - last > 30) {
    last = i; let mx = 0; for (let q = i; q < Math.min(X.n, i + 30); q++) mx = Math.max(mx, r30[q]);
    let mn = Infinity; for (let q = i; q < Math.min(X.n, i + 180); q++) mn = Math.min(mn, bc[q]);
    const g = (k) => BT.o[k][i];
    const f = (v, k = 2) => (isNaN(v) ? '  -  ' : v.toFixed(k).padStart(5));
    // первый день > 20 в эпизоде, если был
    let i20 = -1; for (let q = i; q < Math.min(X.n, i + 30); q++) if (r30[q] > 20) { i20 = q; break; }
    console.log(`${mx > 20 ? '+' : ' '} ${d(X.t[i])} ${f(r30[i], 1)} ${f(mx, 1)} ${f(i + 90 < X.n ? 100 * (bc[i + 90] / bc[i] - 1) : NaN, 0)} ${f(i + 180 < X.n ? 100 * (bc[i + 180] / bc[i] - 1) : NaN, 0)} ${f(100 * (mn / bc[i] - 1), 0)} | ${f(g('b_rsi'), 0)} ${f(g('b_wrsi'), 0)} ${f(g('b_w20'))} ${f(g('b_w50'))} ${f(g('b_w200'))} ${f(g('b_bbz'), 1)} ${f(g('b_macdh'), 1)} ${f(g('b_don90'))} ${g('b_hl')} ${g('b_hh')} ${f(g('b_vol'), 1)} ${f(g('b_bbwp'))}${i20 > 0 ? '  (>20 на ' + (i20 - i) + '-й день)' : ''}`);
  }
}
