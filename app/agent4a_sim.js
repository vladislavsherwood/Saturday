/* Агент 4A (покупки ближе к дну и «размазанные» по дну): помощники поверх agent2_sim.js.
   Эталон W25 (found/agent2-best.json), дополнительные индикаторы дна (только прошлое), строка сравнения с W25,
   разбор покупок резерва по правилам и по отношению к крупным доньям.
   Использование: const A = require('./agent4a_sim.js'); const G = A.groups(); const base = A.ev(G, A.W25); console.log(A.row(tag, A.ev(G, S), base)) */
const A2 = require('./agent2_sim.js');
const fs = require('fs');
const W25 = JSON.parse(fs.readFileSync(__dirname + '/found/agent2-best.json', 'utf8'));
const { c } = A2;
function rollMax(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] <= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
function rollMin(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] >= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
// дополнительные индикаторы (регистрируются в A2.EXTRA; считаются при загрузке групп). Каждый — только по прошлому.
const X4 = [];
function feats(X) {
  if (X.ind.a4done) return; X.ind.a4done = new Float64Array(X.n);
  const n = X.n, I = X.ind, b = I.btcp;
  // дни с максимума биткоина (длительность медвежьего рынка), просадка BTC от максимума за 365 дней
  { const o = new Float64Array(n); let m = -Infinity, d = 0; for (let i = 0; i < n; i++) { if (!(b[i] < m)) { m = b[i]; d = 0; } else d++; o[i] = d; } I.btcdays = o; }
  // монета: позиция к минимуму за 30/90 дней (c / min − 1, %)
  for (const w of [30, 90]) { const mn = rollMin(X.c, w), o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = (X.c[i] / mn[i] - 1) * 100; I['cmin' + w] = o; }
  for (const f of X4) f(X);
}
A2.EXTRA.push(feats);
const groups = (list) => A2.groups(list);
const ev = (G, S, withM = true) => A2.ev(G, S, withM);
const bw = (r, b, g) => [r[g].e.filter((v, i) => v > b[g].e[i] + 0.5).length, r[g].e.filter((v, i) => v < b[g].e[i] - 0.5).length];
function row(tag, r, b) { const n = r.n100 && b.n100 ? ` | 100н лучше/хуже ${bw(r, b, 'n100').join('/')}` : ''; const k = r.m ? ` дн/дно ${r.m.buysPerBottom.toFixed(1)}` : ''; return A2.show(tag, r, b) + k + n; }
function addInd(G, key, fn) { for (const g in G) for (const X of G[g]) if (!X.ind[key]) X.ind[key] = fn(X); }
const flagOf = (n, f) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = f(i) ? 1 : 0; return a; };
const addRule = (S, rule, pos = 'end') => { const R = [...S.rules]; if (pos === 'end') R.push(rule); else R.splice(pos, 0, rule); return { ...S, rules: R }; };
const addCond = (S, f, conds) => ({ ...S, rules: S.rules.map((r, i) => (f(r, i) ? { ...r, conds: [...r.conds, ...conds] } : r)) });
// индексы правил W25 по смыслу
const isBuy = (r) => r.act > 1;
function save(rows, file) { fs.writeFileSync(file, JSON.stringify(rows)); }
module.exports = { ...A2, A2, W25, groups, ev, row, bw, addInd, flagOf, addRule, addCond, rollMax, rollMin, X4, isBuy, save, c };
