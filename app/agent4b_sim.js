/* Агент 4B (продажи ближе к вершине): помощники поверх agent2_sim.js — эталон W25 (found/agent2-best.json),
   сравнение кандидата с W25, разбор продаж по правилам, разбор пропущенных крупных вершин, вставка правил продажи.
   Использование: const B = require('./agent4b_sim.js'); const G = B.groups(); const base = B.ev(G, B.W25); console.log(B.show(tag, B.ev(G, S), base)) */
const A = require('./agent2_sim.js');
const fs = require('fs');
const W25 = JSON.parse(fs.readFileSync(__dirname + '/found/agent2-best.json', 'utf8'));
const { c } = A;
const SCR = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad';
function rollMax(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] <= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
function rollMin(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] >= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
// новый индикатор на всех монетах всех групп
function addInd(G, key, fn) { for (const g in G) for (const X of G[g]) if (!X.ind[key]) X.ind[key] = fn(X); }
const runOf = (n, cond) => { const a = new Float64Array(n); let r = 0; for (let i = 0; i < n; i++) { r = cond(i) ? r + 1 : 0; a[i] = r; } return a; };
// дней с последнего дня, когда cond был истинным (NaN — ещё не было)
const since = (n, cond) => { const a = new Float64Array(n); let s = NaN; for (let i = 0; i < n; i++) { s = cond(i) ? 0 : s + 1; a[i] = s; } return a; };
// индикатор по скользящему максимуму другого ряда за w дней
const rmax = (a, w) => { const n = a.length, b = new Float64Array(n); for (let i = 0; i < n; i++) b[i] = isNaN(a[i]) ? -Infinity : a[i]; const o = rollMax(b, w); for (let i = 0; i < n; i++) if (o[i] === -Infinity) o[i] = NaN; return o; };
const ev = (G, S, withM = true) => A.ev(G, S, withM);
const bw = (r, b, g) => [r[g].e.filter((v, i) => v > b[g].e[i] + 0.5).length, r[g].e.filter((v, i) => v < b[g].e[i] - 0.5).length];
function show(tag, r, b) { const s = A.show(tag, r, b); const n = r.n100 && b.n100 ? ` [100н +${bw(r, b, 'n100').join('/−')}]` : ''; return s + n; }
// вставить правило(а) перед индексом at (по умолчанию в конец)
const ins = (S, rules, at = S.rules.length) => ({ ...S, rules: [...S.rules.slice(0, at), ...rules, ...S.rules.slice(at)] });
const isW = (r) => r.act === -0.25 && A.has(r, 'oth90');
// разбор продаж по правилам: доля денег, цена к максимуму ±90 дн
function sellsByRule(Arr, S) {
  const o = {};
  for (const X of Arr) { const M = A.S ? null : null; }
  const sim = A.S;
  for (const X of Arr) {
    const { tr } = sim.edge(X, S, 0, 'full', true); const M = prepM(X);
    for (const t of tr) if (t.s < 0) { const k = t.q; o[k] = o[k] || { amt: 0, top: 0, n: 0 }; o[k].amt += t.amt; o[k].top += t.amt * t.p / M.maxW[t.i]; o[k].n++; }
  }
  return o;
}
// повтор prepM из agent_sim (там не экспортирован)
function prepM(X) {
  if (X.M) return X.M;
  const cc = X.c, n = X.n, bot = [], top = [];
  const slide = (w0, w1, f, init) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = init; for (let j = Math.max(0, i - w0); j <= Math.min(n - 1, i + w1); j++) m = f(m, cc[j]); o[i] = m; } return o; };
  const mf = slide(0, 90, Math.min, Infinity), mw = slide(180, 180, Math.min, Infinity), xw = slide(90, 90, Math.max, 0), xw180 = slide(180, 180, Math.max, 0), pmax = slide(365, -1, Math.max, 0), pmin = slide(365, -1, Math.min, Infinity);
  for (let i = 200; i < n - 30; i++) { if (cc[i] === mw[i] && cc[i] <= 0.5 * pmax[i]) bot.push(i); if (cc[i] === xw180[i] && cc[i] >= 2 * pmin[i]) top.push(i); }
  return (X.M = { minF: mf, minW: mw, maxW: xw, bot, top });
}
// пропущенные крупные вершины: монета, дата, лучшая продажа в ±90 дн (к вершине), индикаторы в день вершины
function missed(Arr, S, inds = ['btcath', 'oth90', 'fng', 'fund30', 'mvrv', 'qt']) {
  const out = [];
  for (const X of Arr) { const M = prepM(X), { tr } = A.S.edge(X, S, 0, 'full', true);
    for (const i of M.top) { const near = tr.filter((t) => t.s < 0 && Math.abs(t.i - i) <= 90); const best = near.length ? Math.max(...near.map((t) => t.p / X.c[i])) : 0;
      if (best < 0.7) out.push({ coin: X.name, page: X.page, d: new Date(X.t[i] * 86400000).toISOString().slice(0, 10), best: +(best * 100).toFixed(0), ind: Object.fromEntries(inds.map((k) => [k, X.ind[k] ? +X.ind[k][i].toFixed(2) : null])) }); } }
  return out;
}
module.exports = { ...A, A, W25, ev, show, bw, ins, isW, addInd, runOf, since, rmax, rollMax, rollMin, sellsByRule, prepM, missed, SCR, c };
