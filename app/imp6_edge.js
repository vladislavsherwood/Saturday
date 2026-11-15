/* imp6: по-монетный оценщик (копия agent_sim.edge без шорта и модификаторов) с размазыванием сигнальных сделок:
   доля сигнала исполняется частями WT[0] в день исполнения, WT[1] на следующий день, … (продажа — доля монет на день сигнала,
   покупка — доля суммы (act − 1)·резерв на день сигнала, ограничена резервом). Какие правила размазывать — split(r).
   lag: 0 — в срок (как в стенде), 1 — на день позже, −1 — по закрытию дня решения. Использование: node app/imp6_edge.js */
const K = require('./combo_sim.js');
const FEE = 0.001, UNIT = 10;
function edgeS(X, S, lag, part = 'full', WT = [1], split = () => false) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, sp: split(r), cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]) }));
  const dec = (j) => { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; };
  let cash = 0, units = 0, du = 0; const QS = new Float64Array(b + 4), QV = new Float64Array(b + 4);
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 && j < X.n ? dec(j) : -2, before = cash, a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base, sp = q >= 0 && R[q].sp && WT.length > 1;
    cash += UNIT;
    let qs = QS[i], qv = QV[i];
    if (a < 0) { const f = -a; if (sp) { for (let k = 1; k < WT.length; k++) QS[i + k] += f * WT[k] * units; qs += f * WT[0] * units; } else qs += f * units; }
    if (qs > 0 && units > 0) { const u = Math.min(qs, units); units -= u; cash += u * p * (1 - FEE); }
    if (a > 0) {
      let ex = (a - 1) * before;
      if (sp && ex > 0) { for (let k = 1; k < WT.length; k++) QV[i + k] += ex * WT[k]; ex *= WT[0]; }
      const amt = Math.min(cash, UNIT + ex + qv); units += (amt * (1 - FEE)) / p; cash -= amt;
    }
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return (fin / dca - 1) * 100;
}
const E2 = (X, S, part, WT, sp, lags) => Math.min(...lags.map((l) => edgeS(X, S, l, part, WT, sp)));
function evalG(A, S, WT, sp, lags) {
  const full = A.map((X) => E2(X, S, 'full', WT, sp, lags)), halves = A.flatMap((X) => [E2(X, S, 'h1', WT, sp, lags), E2(X, S, 'h2', WT, sp, lags)]);
  return { ...K.stat(full, halves), e: full };
}
const evAll = (G, S, WT, sp, lags) => { const o = {}; for (const g in G) o[g] = evalG(G[g], S, WT, sp, lags); return o; };
module.exports = { edgeS, evAll };
if (require.main === module) {
  const G = K.groups(['sel', 'ex', 'rnd', 'n100']); K.prep(G);
  const fs = require('fs'); const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
  const S = { base: BEST.base, rules: BEST.rules };
  const has = (r, k) => r.conds.some((cd) => cd.ind === k);
  const isPanBot = (r) => r.act > 1.15 && (has(r, 'usdt') || (r.conds.length === 1 && (has(r, 'fng') || has(r, 'oidd30'))));
  const isSell = (r) => r.act < 0;
  const V = [['основа', [1], () => false], ['паника+дно 50/50', [0.5, 0.5], isPanBot], ['продажи 50/50', [0.5, 0.5], isSell],
    ['паника+дно+продажи 50/50', [0.5, 0.5], (r) => isPanBot(r) || isSell(r)], ['паника+дно+продажи 1/3×3', [1 / 3, 1 / 3, 1 / 3], (r) => isPanBot(r) || isSell(r)]];
  const t0 = Date.now(); let base = null;
  for (const lags of [[0, 1], [-1, 0, 1]]) {
    console.log(`\n=== худший из сдвигов [${lags}]`);
    base = null;
    for (const [tag, WT, sp] of V) {
      const r = evAll(G, S, WT, sp, lags); if (!base) base = r;
      const n = r.n100, hb = K.passes(r, base) ? '✔' : '· ' + K.why(r, base);
      console.log(`${tag.padEnd(28)} ${K.line(r)} | доход ${(K.inc(r) - K.inc(base)).toFixed(3)} | 100н ${n.med.toFixed(0)}/${n.pos}/${n.hpos} | ${hb} [${((Date.now() - t0) / 1000).toFixed(0)} с]`);
    }
  }
}
