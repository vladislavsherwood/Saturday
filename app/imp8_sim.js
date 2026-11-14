/* imp8 (упрощение и устойчивость): помощники поверх combo_sim.js — основа combo-best (F + C1.25 + C6), логические блоки правил,
   удаление блоков, окно по времени (вперёд по времени), бутстрэп. Только чтение общих помощников.
   Использование: const I = require('./imp8_sim.js'); const G = I.load(['sel','ex','rnd']); */
const K = require('./combo_sim.js');
const fs = require('fs');
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE = { base: BEST.base, rules: BEST.rules };
const has = (r, ind) => r.conds.some((x) => x.ind === ind);
const isC = (r) => has(r, 'rel180');
const isC6 = (r) => r.act > 1 && r.conds.filter((x) => x.ind === 'usdt').length === 2;
// логические блоки основы по индексам правил combo-best (28 правил)
const UNITS = {
  'B0 fng<10 покупка 25%': [0],
  'B1 отложенная (dly20) 50%': [1],
  'B2 вынос OI<−28 50%': [2],
  'B3 паника+fng<40 (#3-5)': [3, 4, 5],
  'B3s паника+fng<40 без OI 10% (#5)': [5],
  'B4 паника+fng<52 (#6-8)': [6, 7, 8],
  'B4s паника+fng<52 без OI 10% (#8)': [8],
  'G9 охрана: разворот BTC держит страх (#9)': [9],
  'B10 разворот+горячий фандинг 100% (#10)': [10],
  'B11 паника без fng (#11-13)': [11, 12, 13],
  'B11s паника без OI 10% (#13)': [13],
  'S14 страх fng<40 продажа 30% (#14-15)': [14, 15],
  'S16 страх fng<52 продажа 16% (#16-17)': [16, 17],
  'B18 разворот BTC 100% (#18)': [18],
  'S19 фандинг продажа 5% (#19-20)': [19, 20],
  'S21 тихая вершина 40% (#21-22)': [21, 22],
  'S23 широкая тихая 50% (#23-24)': [23, 24],
  'B25 возврат 10% (#25)': [25],
  'S26 памп в медведе 10% (#26-27)': [26, 27],
};
const MODS = { 'M:C (rel180 ×1,25)': (r) => isC(r), 'M:C6 (usdt>1,2 ×1,5)': (r) => isC6(r) };
const drop = (S, idx, f = () => false) => ({ ...S, rules: S.rules.filter((r, i) => !idx.includes(i) && !f(r)) });
// ---------- окно по времени: старт с нуля в день a0 (индексы), индикаторы по полной прошлой истории ----------
const FEE = 0.001, UNIT = 10;
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
function edgeW(X, S, lag, a0, b) {
  const c = X.c, R = compile(X, S.rules); let cash = 0, units = 0, du = 0;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash; const a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    cash += UNIT;
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); } }
    else if (a > 0) { const amt = Math.min(cash, UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; }
  }
  return ((units * c[b - 1] + cash) / (du * c[b - 1]) - 1) * 100;
}
const yIdx = (X, y) => { const t = Date.UTC(y, 0, 1) / 864e5; let i = 0; while (i < X.n && X.t[i] < t) i++; return i; };
// итог монеты в окне [годA, годB): худший из двух сдвигов; null, если в окне < minD дней
function EW(X, S, y0, y1, minD = 365) { const a = y0 ? yIdx(X, y0) : 0, b = y1 ? yIdx(X, y1) : X.n; if (b - a < minD) return null; return Math.min(edgeW(X, S, 0, a, b), edgeW(X, S, 1, a, b)); }
const load = (list = ['sel', 'ex', 'rnd']) => { const G = K.groups(list); K.prep(G); return G; };
const lm = (v) => Math.log1p(K.med(v) / 100);
module.exports = { K, BEST, BASE, UNITS, MODS, drop, isC, isC6, has, edgeW, EW, yIdx, load, lm };
// упрощённые варианты круга 1. S2: без #6-8 (паника + fng<52 — копия #11-13) и #10 (разворот + фандинг — то же, что #18), охрана #9 переставлена
// за блок паники #11-13 (в основе она и так никогда не перебивала панику: #3-8 покрывали все дни паники со страхом и usdtd < 7,6),
// без мёртвых условий (#14-15 fng<52 при fng<40; #25 ago_qt>0.5; #5 — копия #8 после перестановки); rmUsdtd (по умолчанию) — ещё и без usdtd<7,6 в охране #9
function simplify(S0 = BASE, { dropIdx = [5, 6, 7, 8, 10], rmUsdtd = true } = {}) {
  const rm = { 14: ['fng<52'], 15: ['fng<52'], 25: ['ago_qt>0.5'] }; if (rmUsdtd) rm[9] = ['usdtd'];
  const R = S0.rules.map((r, i) => (!rm[i] ? r : { ...r, conds: r.conds.filter((x) => !rm[i].some((k) => k === x.ind || k === x.ind + x.op + x.v)) }));
  const keep = R.map((r, i) => [r, i]).filter(([, i]) => !dropIdx.includes(i));
  const g9 = keep.findIndex(([, i]) => i === 9), [guard] = keep.splice(g9, 1), after = keep.findIndex(([, i]) => i === 13);
  keep.splice(after + 1, 0, guard);
  return { ...S0, rules: keep.map(([r]) => r) };
}
module.exports.simplify = simplify;
