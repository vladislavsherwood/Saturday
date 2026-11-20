/* h2: дно цикла в затяжном медвежьем рынке (12.2018, 06/11.2022; проверка — 2015, 03.2020). Общие помощники.
   Основа — combo4 (found/combo4-best.json, 57 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + «ловушка для фитилей» (wick-best).
   Добавляет индикаторы (всё по прошлым данным):
     h2wma  — BTC / 200-недельная средняя (1400-дн. SMA закрытий BTC; ряд BTC Yahoo с 2014-09-17 — ../dca/cache/BTC-USD.csv; есть с 2018-07);
     h2bwr  — недельный RSI(14) BTC (Уайлдер по закрытиям через 7 дней, скользящий: последняя «неделя» кончается вчера);
     h2cwr  — недельный RSI(14) монеты (так же);
     h2bear — дней с последнего максимума BTC (по ряду Yahoo с 2014-09);
     h2mvd  — дней подряд MVRV BTC < 1;
     h2bup  — рост BTC от минимума 30 дней, %; h2bup60 — от минимума 60 дней;
     h2bvr  — волатильность BTC 30 дн / 365 дн (всплеск волатильности);
     h2cup  — рост монеты от своего минимума 30 дней, %.
   Использование: const H = require('./h2_lib.js'); H.base('wick') — основа combo4 + фитили; H.run(имя, S, pol). */
const fs = require('fs');
const L = require('./r4_lib.js'), { P, G, c } = L;
const S57 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polW = { ...L.pol0, wick: WICK };
// ряд BTC (Yahoo, с 2014-09-17) по дням
const csv = fs.readFileSync(__dirname + '/../dca/cache/BTC-USD.csv', 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const BT = csv.map(([d]) => Math.round(Date.parse(d) / 864e5)), BC = csv.map(([, x]) => +x);
const nB = BT.length, bIdx = new Map(BT.map((t, i) => [t, i]));
function wrsi(cc, n, w = 14, step = 7) { // скользящий недельный RSI: в день i — по закрытиям i, i−7, i−14, …
  const o = new Float64Array(n).fill(NaN);
  for (let i = step * (w + 30); i < n; i++) {
    let ag = 0, al = 0, k0 = i - step * (w + 30); // разгон 30 недель
    for (let s = 1; s <= w; s++) { const d = cc[k0 + s * step] - cc[k0 + (s - 1) * step]; if (d > 0) ag += d / w; else al -= d / w; }
    for (let k = k0 + (w + 1) * step; k <= i; k += step) { const d = cc[k] - cc[k - step]; ag = (ag * (w - 1) + Math.max(d, 0)) / w; al = (al * (w - 1) + Math.max(-d, 0)) / w; }
    o[i] = 100 - 100 / (1 + ag / (al || 1e-12));
  }
  return o;
}
const bwma = new Float64Array(nB).fill(NaN); { let s = 0; for (let i = 0; i < nB; i++) { s += BC[i]; if (i >= 1400) s -= BC[i - 1400]; if (i >= 1399) bwma[i] = BC[i] / (s / 1400); } }
const bwr = wrsi(BC, nB);
const bbear = new Float64Array(nB); { let mx = 0, at = 0; for (let i = 0; i < nB; i++) { if (BC[i] >= mx) { mx = BC[i]; at = i; } bbear[i] = i - at; } }
const bup = (w) => { const o = new Float64Array(nB).fill(NaN); for (let i = w; i < nB; i++) { let m = Infinity; for (let k = i - w + 1; k <= i; k++) m = Math.min(m, BC[k]); o[i] = (BC[i] / m - 1) * 100; } return o; };
const bup30 = bup(30), bup60 = bup(60), bup14 = bup(14);
const lr = BC.map((x, i) => (i ? Math.log(x / BC[i - 1]) : 0));
const sd = (w) => { const o = new Float64Array(nB).fill(NaN); for (let i = w; i < nB; i++) { let s = 0, s2 = 0; for (let k = i - w + 1; k <= i; k++) { s += lr[k]; s2 += lr[k] * lr[k]; } o[i] = Math.sqrt(Math.max(0, s2 / w - (s / w) ** 2)); } return o; };
const sd30 = sd(30), sd365 = sd(365);
const bsma = (w) => { const o = new Float64Array(nB).fill(NaN); let s = 0; for (let i = 0; i < nB; i++) { s += BC[i]; if (i >= w) s -= BC[i - w]; if (i >= w - 1) o[i] = BC[i] / (s / w); } return o; };
const b20 = bsma(20), b50 = bsma(50);
for (const g in G) for (const X of G[g]) {
  const I = X.ind, n = X.n, map = (A) => { const a = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) { const k = bIdx.get(I.t[i]); if (k != null) a[i] = A[k]; } return a; };
  I.h2wma = map(bwma); I.h2bwr = map(bwr); I.h2bear = map(bbear); I.h2bup = map(bup30); I.h2bup60 = map(bup60); I.h2bup14 = map(bup14);
  I.h2bvr = map(Float64Array.from(sd30, (x, i) => x / sd365[i])); I.h2b20 = map(b20); I.h2b50 = map(b50);
  I.h2cwr = wrsi(X.c, n);
  const mvd = new Float64Array(n); for (let i = 0; i < n; i++) mvd[i] = I.mvrv[i] < 1 ? (i ? mvd[i - 1] : 0) + 1 : 0; I.h2mvd = mvd;
  const cu = new Float64Array(n).fill(NaN); for (let i = 29; i < n; i++) { let m = Infinity; for (let k = i - 29; k <= i; k++) m = Math.min(m, X.c[k]); cu[i] = (X.c[i] / m - 1) * 100; } I.h2cup = cu;
  const ms = new Float64Array(n); { let last = -1e9; for (let i = 0; i < n; i++) { if (I.mvrv[i] < 1) last = i; ms[i] = i - last; } } I.h2mvs = ms; // дней с последнего дня MVRV < 1
  for (const [k, q] of [['h2fd', 10], ['h2fd15', 15], ['h2fd20', 20]]) { const a = new Float64Array(n); let last = -1e9; for (let i = 0; i < n; i++) { if (I.fng[i] < q) last = i; a[i] = i - last; } I[k] = a; } // дней с последнего дня страха < q
  for (const [k, q] of [['h2capr', 10], ['h2capr15', 15], ['h2capr20', 20]]) { const a = new Float64Array(n).fill(NaN); let p = NaN; for (let i = 0; i < n; i++) { if (I.fng[i] < q) p = X.c[i]; a[i] = X.c[i] / p; } I[k] = a; } // цена монеты к её закрытию в последний день страха < q
  { const a = new Float64Array(n), b = new Float64Array(n); let l1 = -1e9, l2 = -1e9; for (let i = 0; i < n; i++) { if (I.oidd30 && I.oidd30[i] < -28) l1 = i; if (I.fng[i] < 10 || (I.oidd30 && I.oidd30[i] < -28) || (I.dly20_100f && I.dly20_100f[i] > 0.5)) l2 = i; a[i] = i - l1; b[i] = i - l2; } I.h2liq = a; I.h2cap = b; } // дней с волны ликвидаций / с любого из правил 1–3 combo4
}
/* «отложенная покупка дна»: правила с полем h2: 1 — второй долг стенда (pol.other / buyO / releaseO / expireO, st.oo; panicx_sim не меняется).
   o.k — доля сразу (0 — всё в долг); o.rel(I, j) → true — выдать долг (× o.m: надбавка (m − 1) × долг из резерва, через pol.extra вместе с Boost);
   o.exp(I, j) → true — долг сгорает (деньги остаются в резерве). Выдача вызывается стендом в любой день покупки/взноса (не в день продажи). */
function polZ(o, basePol = polW) {
  const m = o.m || 1, ex0 = basePol.extra;
  return { ...basePol, other: (r) => r.h2 === 1, buyO: ({ share }) => share * (o.k || 0),
    releaseO: ({ X, j, st }) => { if (o.rel(X.ind, j, X)) { st.h2rl = st.oo; return 1; } return 0; },
    expireO: ({ X, j }) => (o.exp ? o.exp(X.ind, j, X) : false),
    extra: (ctx) => { const e0 = ex0 ? ex0(ctx) : 0; let e1 = 0; if (ctx.st.h2rl) { e1 = ((m - 1) * ctx.st.h2rl) / Math.max(ctx.before, 1e-9); ctx.st.h2rl = 0; } return e0 + e1; } };
}
function base(kind = 'wick') { const pol = kind === 'wick' ? polW : L.pol0; P.setBaseline(S57, pol); return pol; }
// вставить правила: at — 'top' (первыми), 'buys' (после правил покупки 1–9, перед охраной 10 и продажами на страхе), 'fear' (после 10, перед 11), 'end' (последними), число — индекс
function ins(rules, at = 'buys', S = S57) {
  const T = L.clone(S); const k = at === 'top' ? 0 : at === 'buys' ? 9 : at === 'fear' ? 10 : at === 'end' ? T.rules.length : at;
  T.rules.splice(k, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return T;
}
// полный отчёт строкой (r4_lib.run) + сжатая строка для журнала
const short = (r) => `${r.txt.slice(0, 44)} ${['sel', 'ex', 'rnd'].map((g) => Math.round(r.RS[g].all.med)).join('/')} | ${L.sg(r.dseg.all)} к ${L.sg(r.dseg.big)} а ${L.sg(r.dseg.alt)} м ${L.sg(r.dseg.meme)} ${r.w ? '✗' : '✔'}${r.n100 ? ` | 100н ${L.sg(r.n100.m)} ${r.n100.u}/${r.n100.d} мед ${Math.round(r.n100.med)}` : ''}${r.w ? ' | ' + r.w.slice(0, 160) : ''}`;
function run(nm, S, pol, o = {}) { const r = L.run(nm, S, pol, { ...o, quiet: true }); r.s = short(r); if (!o.quiet) console.log(r.s); return r; }
// средний лог по 81 монете к основе (устойчивее медиан) + лучше/хуже
function m81(r) { const { BR } = P.baseline(); return L.Z.mlog(r.R, BR, 'all', ['sel', 'ex', 'rnd']); }
// половины: доход (Σ лог-медиан) отдельно по h1 и h2 к основе
function halves(r) { const { BR } = P.baseline(); const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }; const L1 = L.Z.L1;
  const o = {}; for (const h of ['h1', 'h2']) { let d = 0; for (const g of ['sel', 'ex', 'rnd']) d += L1(med(r.R[g].map((x) => x[h]))) - L1(med(BR[g].map((x) => x[h]))); o[h] = d; } return o; }
module.exports = { L, P, G, c, S57, WICK, polW, polZ, base, ins, run, short, m81, halves, day: L.day, T: L.T };
