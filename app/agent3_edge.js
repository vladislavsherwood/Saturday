/* Агент 3: копия оценщика agent_sim.js (edge, половины, метрики) с «лесенкой по цене» для покупок и продаж резерва.
   S.bl = {drop, win, k}: день покупки резерва (правило с act > 1) — если за последние win дней уже была покупка резерва по цене P,
   а сегодня цена выше P·(1 − drop), доля покупки умножается на k (0 — только взнос). Так докупки идут только ниже прошлой покупки.
   S.sl = {rise, win, k}: то же для продаж — повторная продажа за win дней только по цене выше прошлой продажи·(1 + rise), иначе доля ×k.
   Без S.bl/S.sl результат совпадает с agent_sim.edge до бита. Использование: const E3 = require('./agent3_edge.js'); E3.evalAll(G, S, true) */
const S0 = require('./agent_sim.js');
const FEE = 0.001, UNIT = 10;
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) {
  for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; }
  return -1;
}
function edge(X, S, lag, part = 'full', rec = false) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), BL = S.bl, SL = S.sl;
  let cash = 0, units = 0, du = 0, lbP = NaN, lbI = -1e9, lsP = NaN, lsI = -1e9; const tr = rec ? [] : null;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    let a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    if (BL && a > 1 && i - lbI <= BL.win && p > lbP * (1 - BL.drop)) a = 1 + (a - 1) * BL.k;
    if (SL && a < 0 && i - lsI <= SL.win && p < lsP * (1 + SL.rise)) a = a * SL.k;
    cash += UNIT;
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); lsP = p; lsI = i; if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) { const amt = Math.min(cash, UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; if (amt > UNIT + 1e-9) { if (!(BL && BL.keep && i - lbI <= BL.win && p > lbP)) { lbP = p; } lbI = i; if (rec) tr.push({ i, s: 1, amt: amt - UNIT, p, q }); } }
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, tr, fin, dca, units, cash };
}
const E = (X, S, part) => Math.min(edge(X, S, 0, part).e, edge(X, S, 1, part).e);
function evalGroup(A, S) { const full = A.map((X) => E(X, S, 'full')), halves = A.flatMap((X) => [E(X, S, 'h1'), E(X, S, 'h2')]); return { ...S0.stat(full, halves), e: full }; }
function metrics(A, S) {
  // как agent_sim.metrics, но сделки — из этой копии edge
  let bAbove = 0, zW = 0, totB = 0, sw = 0, sTop = 0, bott = 0, bottHit = 0, bottBuys = 0, bott3 = 0, tops = 0, topsMissed = 0;
  for (const X of A) {
    const c = X.c, M = S0.metricsPrep ? S0.metricsPrep(X) : prepM(X), { tr } = edge(X, S, 0, 'full', true);
    for (const t of tr) { if (t.s > 0) { totB += t.amt; bAbove += t.amt * (t.p / M.minF[t.i] - 1); if (t.p <= 1.15 * M.minW[t.i]) zW += t.amt; } else { sw += t.amt; sTop += t.amt * (t.p / M.maxW[t.i]); } }
    for (const i of M.bot) { bott++; const days = new Set(tr.filter((t) => t.s > 0 && Math.abs(t.i - i) <= 120 && t.p <= 1.15 * c[i]).map((t) => t.i)); if (days.size) bottHit++; if (days.size >= 3) bott3++; bottBuys += days.size; }
    for (const i of M.top) { tops++; if (!tr.some((t) => t.s < 0 && Math.abs(t.i - i) <= 90 && t.p >= 0.7 * c[i])) topsMissed++; }
  }
  return { buyAbove90: (100 * bAbove) / totB, zone15: (100 * zW) / totB, bottHit: (100 * bottHit) / bott, bott3: (100 * bott3) / bott, buysPerBottom: bottBuys / bott, sellToTop: (100 * sTop) / sw, missedTops: (100 * topsMissed) / tops, nBott: bott, nTops: tops };
}
function prepM(X) {
  if (X.M) return X.M;
  const c = X.c, n = X.n, bot = [], top = [];
  const slide = (w0, w1, f, init) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = init; for (let j = Math.max(0, i - w0); j <= Math.min(n - 1, i + w1); j++) m = f(m, c[j]); o[i] = m; } return o; };
  const mf = slide(0, 90, Math.min, Infinity), mw = slide(180, 180, Math.min, Infinity), xw = slide(90, 90, Math.max, 0), xw180 = slide(180, 180, Math.max, 0), pmax = slide(365, -1, Math.max, 0), pmin = slide(365, -1, Math.min, Infinity);
  for (let i = 200; i < n - 30; i++) { if (c[i] === mw[i] && c[i] <= 0.5 * pmax[i]) bot.push(i); if (c[i] === xw180[i] && c[i] >= 2 * pmin[i]) top.push(i); }
  return (X.M = { minF: mf, minW: mw, maxW: xw, bot, top });
}
function evalAll(G, S, withM = false) { const o = {}; for (const g in G) o[g] = evalGroup(G[g], S); if (withM) o.m = metrics([...(G.sel || []), ...(G.ex || []), ...(G.rnd || [])], S); return o; }
module.exports = { edge, E, evalGroup, evalAll, metrics };
