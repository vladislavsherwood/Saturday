/* Агент «КРУПНЫЕ МОНЕТЫ»: помощники поверх combo_sim.js (быстрый оценщик agent_sim.js).
   Список крупных монет, окна истории (годы, половины, «с года старта»), разбор сделок, простой резерва, сравнение вариантов
   на всей выборке (строгая проверка + доход) и отдельно на группе крупных.
   Использование: const Z = require('./seg_big_sim.js'); const G = Z.load(); const base = Z.BASE; Z.cmp(G, S, base) */
const K = require('./combo_sim.js');
const fs = require('fs');
const BIG = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'TRX', 'ADA', 'LTC', 'BCH'];
const BASE = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE_S = { base: BASE.base, rules: BASE.rules };
const day0 = (y) => Math.round(Date.UTC(y, 0, 1) / 864e5);
const ymd = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
function load(list = ['sel', 'ex', 'rnd']) { const G = K.groups(list); K.prep(G); return G; }
const bigOf = (G) => BIG.map((nm) => G.sel.find((X) => X.name === nm));
// срез ряда [a, b) — индикаторы считаны по полной истории (только прошлое), решения в первый день среза — как в начале ряда
function slice(X, a, b) {
  const Y = { name: X.name, page: X.page, n: b - a, N: X.N, ind: {} };
  for (const k in X.ind) Y.ind[k] = X.ind[k].subarray(a, b);
  Y.c = Y.ind.c; Y.t = Y.ind.t; Y.l = Y.ind.l; Y.h = Y.ind.h;
  return Y;
}
const idxOf = (X, t) => { for (let i = 0; i < X.n; i++) if (X.t[i] >= t) return i; return X.n; };
// итог к DCA на окне [a, b), худший из двух сдвигов
const Ew = (X, S, a, b) => { const Y = slice(X, a, b); return Math.min(K.edge(Y, S, 0).e, K.edge(Y, S, 1).e); };
// окна: календарные годы (≥ 200 дней), «с 1 января года Y до конца», половины
function windows(X) {
  const o = [];
  for (let y = 2016; y <= 2026; y++) {
    const a = idxOf(X, day0(y)), b = idxOf(X, day0(y + 1));
    if (b - a >= 200) o.push({ k: 'y' + y, a, b });
    if (X.n - a >= 300 && a < X.n) o.push({ k: 's' + y, a, b: X.n });
  }
  const h = Math.floor(X.n / 2); o.push({ k: 'h1', a: 0, b: h }, { k: 'h2', a: h, b: X.n }, { k: 'full', a: 0, b: X.n });
  return o;
}
// простой резерва: средняя доля кэша в стоимости портфеля (по дням), и сделки
function trace(X, S) {
  const { tr } = K.edge(X, S, 0, 'full', true);
  // повтор цикла, чтобы получить путь кэша и монет (как в edge, без шорта)
  const R = tr; return R;
}
function cashPath(X, S) {
  const FEE = 0.001, UNIT = 10, c = X.c;
  const tr = K.edge(X, S, 0, 'full', true).tr; const byDay = new Map(); for (const t of tr) byDay.set(t.i, t);
  // восстановление через повтор edge с записью: проще пересчитать вручную по сделкам невозможно (доли зависят от состояния), поэтому копия цикла
  const compile = (rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
  const Rr = compile(S.rules);
  const decide = (j) => { for (let q = 0; q < Rr.length; q++) { let ok = true; for (const [a, lt, v] of Rr[q].cs) { const x = a[j]; if (!(lt ? x < v : x > v)) { ok = false; break; } } if (ok) return q; } return -1; };
  let cash = 0, units = 0; const fr = new Float64Array(X.n), qs = new Int16Array(X.n);
  for (let i = 0; i < X.n; i++) {
    const p = c[i], j = i - 1, q = j >= 0 ? decide(j) : -2, before = cash; qs[i] = q;
    const a = q >= 0 ? Rr[q].act : q === -2 ? 1 : S.base; cash += UNIT;
    if (a < 0) { const amt = -a * units * p; units -= amt / p; cash += amt * (1 - FEE); }
    else if (a > 0) { const amt = Math.min(cash, UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; }
    fr[i] = cash / (cash + units * p);
  }
  return { fr, qs };
}
// сравнение варианта с основой: вся выборка (строгая, доход) и группа крупных (окна)
function bigStats(G, S) {
  const o = {};
  for (const X of bigOf(G)) { o[X.name] = {}; for (const w of windows(X)) o[X.name][w.k] = Ew(X, S, w.a, w.b); }
  return o;
}
const l1 = (v) => Math.log1p(v / 100);
// сводка по крупным: сумма лог(1+e) по монетам на full/h1/h2, число окон-лет лучше/хуже, медиана full
function bigSum(bs, bb) {
  let full = 0, h = 0, yrs = 0, st = 0, better = 0, worse = 0, wy = [];
  const coins = Object.keys(bs);
  for (const nm of coins) {
    full += l1(bs[nm].full) - l1(bb[nm].full); h += l1(bs[nm].h1) - l1(bb[nm].h1) + l1(bs[nm].h2) - l1(bb[nm].h2);
    for (const k in bs[nm]) {
      if (k[0] === 'y') { const d = l1(bs[nm][k]) - l1(bb[nm][k]); yrs += d; if (d > 0.002) better++; if (d < -0.002) worse++; if (d < -0.002) wy.push(nm + k.slice(1) + ' ' + (100 * d).toFixed(1)); }
      if (k[0] === 's') st += l1(bs[nm][k]) - l1(bb[nm][k]);
    }
  }
  const coinsBW = [coins.filter((nm) => bs[nm].full > bb[nm].full + 0.5).length, coins.filter((nm) => bs[nm].full < bb[nm].full - 0.5).length];
  return { full, h, yrs, st, better, worse, coinsBW, wy };
}
const fmtBig = (s) => `крупные: Σлог full ${s.full >= 0 ? '+' : ''}${s.full.toFixed(3)}, половины ${s.h >= 0 ? '+' : ''}${s.h.toFixed(3)}, годы ${s.yrs >= 0 ? '+' : ''}${s.yrs.toFixed(3)} (лучше/хуже ${s.better}/${s.worse}), с года старта ${s.st >= 0 ? '+' : ''}${s.st.toFixed(3)}, монеты лучше/хуже ${s.coinsBW.join('/')}`;
// полная проверка: вся выборка + крупные
function cmp(G, S, base, bbig, tag) {
  const r = K.ev(G, S, false), bs = bigStats(G, S), s = bigSum(bs, bbig);
  const pass = K.passes(r, base) ? '✔' : '· ' + K.why(r, base);
  const rest = restInc(G, S, base);
  return { r, bs, s, pass, d: K.d(r, base), rest, txt: `${tag}\n   все: доход ${K.d(r, base) >= 0 ? '+' : ''}${K.d(r, base).toFixed(3)} | ${K.line(r)} | ${pass}\n   прочие (без крупных): ${rest}\n   ${fmtBig(s)}` };
}
// доход на остальных монетах: медианы отбора без крупных, экзамен, 50 случайных (лог-сумма) к основе
function restInc(G, S, base) {
  const selR = G.sel.map((X, i) => [X, i]).filter(([X]) => !BIG.includes(X.name));
  const a = selR.map(([X]) => K.E(X, S, 'full')), b = selR.map(([, i]) => base.sel.e[i]);
  const better = a.filter((v, i) => v > b[i] + 0.5).length, worse = a.filter((v, i) => v < b[i] - 0.5).length;
  return `отбор без крупных мед ${K.med(a).toFixed(0)} (осн. ${K.med(b).toFixed(0)}), лучше/хуже ${better}/${worse}`;
}
module.exports = { K, BIG, BASE, BASE_S, load, bigOf, slice, idxOf, Ew, windows, cashPath, bigStats, bigSum, fmtBig, cmp, restInc, ymd, day0, l1 };
// флаг «крупная монета по списку» как индикатор (1/0) на всех монетах групп
function addBig(G) { for (const g in G) for (const X of G[g]) { const a = new Float64Array(X.n); if (BIG.includes(X.name)) a.fill(1); X.ind.isbig = a; } }
// копия правил idx (индексы основы) с долей ×k и доп. условиями — вставляется перед исходным; k=0 у продажи → «не продавать» (день без покупки, как у продажи)
function scale(S, idx, k, extra) {
  return { ...S, rules: S.rules.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: r.act < 0 ? (k === 0 ? -1e-9 : Math.max(-1, r.act * k)) : 1 + (r.act - 1) * k, conds: [...r.conds, ...extra] }, r])) };
}
const ins = (S, at, rules) => ({ ...S, rules: [...S.rules.slice(0, at), ...rules, ...S.rules.slice(at)] });
module.exports.addBig = addBig; module.exports.scale = scale; module.exports.ins = ins;
// кандидаты круга 6: B65 — corr180 > 0,65 и vol180 < 90 → тихие вершины ×kq, страх ×kf; LB65 — то же «список ИЛИ B65»
const FEAR_I = [14, 15, 16, 17], QT_I = [21, 22, 23, 24];
function bigSells(S0, kq = 1.5, kf = 1.25, sets = [[{ ind: 'corr180', op: '>', v: 0.65 }, { ind: 'vol180', op: '<', v: 90 }]]) {
  return { ...S0, rules: S0.rules.flatMap((r, q) => { const k = QT_I.includes(q) ? kq : FEAR_I.includes(q) ? kf : 1; return k === 1 ? [r] : [...sets.map((cs) => ({ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...cs] })), r]; }) };
}
const B65 = (S0 = BASE_S) => bigSells(S0);
const LB65 = (S0 = BASE_S) => bigSells(S0, 1.5, 1.25, [[{ ind: 'isbig', op: '>', v: 0.5 }], [{ ind: 'corr180', op: '>', v: 0.65 }, { ind: 'vol180', op: '<', v: 90 }]]);
Object.assign(module.exports, { bigSells, B65, LB65 });
