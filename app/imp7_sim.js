/* Агент улучшения №7 (режим рынка): помощники поверх combo_sim.js (быстрый оценщик agent_sim.js).
   - признаки режима по ПОЛНОМУ ряду BTC (страница отбора, с 2015-04), сопоставление по дню; только прошлое:
     rb200 — BTC / средняя 200 дней; rw50 — BTC / средняя 350 дней (50 недель); rath — % ниже максимума BTC;
     rdays — дней с максимума BTC; rlowd — дней с минимума BTC за прошлые 365 дней (с последнего нового годового минимума);
     rup — % выше минимума BTC за 365 дней; rsl — наклон средней 200 за 30 дней, %.
   - оценка по циклам: монета режется по датам окна (индикаторы уже посчитаны по всей истории), старт с нуля в начале окна.
   - разбор сделок основы по режимам.
   Использование: const M = require('./imp7_sim.js'); const G = M.groups(); M.prep(G); ... */
const K = require('./combo_sim.js');
const A2 = require('./agent2_sim.js');
const S0 = require('./agent_sim.js');
const fs = require('fs');
const { c } = K;
const BASE = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const B0 = { base: BASE.base, rules: BASE.rules };

// ---- ряд BTC и признаки режима ----
let RG = null;
function regimeMap() {
  if (RG) return RG;
  const X = S0.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC');
  const n = X.n, b = X.c, t = X.t;
  const sma = (w) => { const a = new Float64Array(n); let s = 0; for (let i = 0; i < n; i++) { s += b[i]; if (i >= w) s -= b[i - w]; a[i] = i >= w - 1 ? s / w : NaN; } return a; };
  const s200 = sma(200), s350 = sma(350);
  const F = { rb200: new Float64Array(n), rw50: new Float64Array(n), rath: new Float64Array(n), rdays: new Float64Array(n), rlowd: new Float64Array(n), rup: new Float64Array(n), rsl: new Float64Array(n) };
  // максимум BTC до 2015-04 (ноябрь 2013, ~1150 $) — учитываем, чтобы просадка 2015 была настоящей
  let m = 1150, dm = 500;
  for (let i = 0; i < n; i++) {
    if (b[i] >= m) { m = b[i]; dm = 0; } else dm++;
    F.rath[i] = (1 - b[i] / m) * 100; F.rdays[i] = dm;
    F.rb200[i] = b[i] / s200[i]; F.rw50[i] = b[i] / s350[i];
    F.rsl[i] = i >= 229 ? (s200[i] / s200[i - 30] - 1) * 100 : NaN;
    let lo = Infinity, li = i; for (let j = Math.max(0, i - 364); j <= i; j++) if (b[j] <= lo) { lo = b[j]; li = j; }
    F.rup[i] = (b[i] / lo - 1) * 100; F.rlowd[i] = i >= 364 ? i - li : NaN;
  }
  RG = { t, F, n };
  RG.idx = new Map(); for (let i = 0; i < n; i++) RG.idx.set(t[i], i);
  return RG;
}
function addRegime(X) {
  if (X.ind.rb200) return;
  const R = regimeMap();
  for (const k in R.F) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const q = R.idx.get(X.t[i]); a[i] = q == null ? NaN : R.F[k][q]; } X.ind[k] = a; }
}
A2.EXTRA.push(addRegime);
const groups = (list = ['sel', 'ex', 'rnd', 'n100']) => K.groups(list);
const prep = (G) => K.prep(G);

// флаг режима: fn(I, i) → bool; кладёт X.ind[key] (1/0)
function addFlag(G, key, fn) { for (const g in G) for (const X of G[g]) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = fn(X.ind, i) ? 1 : 0; X.ind[key] = a; } }

// ---- типы правил основы (по условиям, а не по индексам) ----
const has = (r, ind) => r.conds.some((cd) => cd.ind === ind);
function kind(r) {
  if (r.act < 0) { if (has(r, 'fng')) return 'fear'; if (has(r, 'fund30')) return 'fund'; if (has(r, 'qt') || has(r, 'oth90')) return 'qt'; if (has(r, 'up90')) return 'pump'; return 'sell?'; }
  if (r.act === 1) return 'dca';
  if (has(r, 'btcr30')) return 'rev';
  if (has(r, 'ago_qt')) return 'ret';
  if (has(r, 'usdt')) return 'panic';
  if (has(r, 'fng')) return 'cap';
  return 'bottom'; // dly…, oidd30 < −28
}
// размеры по режиму: для правил, где sel(kind) истинно, в дни flag > 0.5 — копия правила с долей ×k (покупка: доля резерва; продажа: доля монет)
function scaleK(S, flag, k, sel) {
  if (k === 1) return S;
  return { ...S, rules: S.rules.flatMap((r) => {
    const kd = kind(r); if (!sel(kd, r)) return [r];
    if (r.act > 1) return [{ act: +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6), conds: [...r.conds, c(flag, '>', 0.5)] }, r];
    if (r.act < 0) return [{ act: +Math.max(-1, r.act * k).toFixed(6), conds: [...r.conds, c(flag, '>', 0.5)] }, r];
    return [r];
  }) };
}

// ---- оценка по циклам ----
const DAY = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 864e5);
const CYC = [['2018–19', DAY('2018-01-01'), DAY('2019-12-31')], ['2020–22', DAY('2020-01-01'), DAY('2022-12-31')], ['2023–26', DAY('2023-01-01'), DAY('2026-12-31')]];
function slice(X, a, b) {
  const ind = {}; for (const k in X.ind) ind[k] = X.ind[k].subarray(a, b);
  return { name: X.name, page: X.page, n: b - a, ind, c: ind.c, t: ind.t, l: ind.l, h: ind.h };
}
function cycSlices(G, gl = ['sel', 'ex', 'rnd'], minDays = 270) {
  const out = CYC.map(() => []);
  for (const g of gl) for (const X of G[g]) CYC.forEach(([, d0, d1], k) => {
    let a = 0; while (a < X.n && X.t[a] < d0) a++;
    let b = a; while (b < X.n && X.t[b] <= d1) b++;
    if (b - a >= minDays) out[k].push(slice(X, a, b));
  });
  return out;
}
// по циклам: сумма лог-отношений итога к основе и монет лучше/хуже (порог 0,5 п.п.)
function cycEv(CS, S) { return CS.map((L) => L.map((X) => S0.E(X, S, 'full'))); }
function cycCmp(cr, cb) {
  return cr.map((v, k) => { let s = 0, bt = 0, wr = 0; v.forEach((e, i) => { s += Math.log1p(e / 100) - Math.log1p(cb[k][i] / 100); if (e > cb[k][i] + 0.5) bt++; if (e < cb[k][i] - 0.5) wr++; }); return { s, bt, wr, n: v.length }; });
}
const cycStr = (cc) => cc.map((x, k) => `${CYC[k][0]} ${x.s >= 0 ? '+' : ''}${x.s.toFixed(2)} (${x.bt}/${x.wr})`).join(' | ');
const sameSign = (cc) => cc.every((x) => x.s > 0.005) ? '+++' : cc.every((x) => x.s < -0.005) ? '−−−' : cc.map((x) => (x.s > 0.005 ? '+' : x.s < -0.005 ? '−' : '0')).join('');

// ---- сделки с номером исходного правила ----
function trades(X, S) {
  const R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
  const { tr } = S0.edge(X, S, 0, 'full', true);
  return tr.map((x) => ({ ...x, rule: R[x.q] }));
}
module.exports = { ...K, K, A2, S0, BASE, B0, groups, prep, addFlag, kind, scaleK, CYC, DAY, slice, cycSlices, cycEv, cycCmp, cycStr, sameSign, trades, regimeMap, c };
