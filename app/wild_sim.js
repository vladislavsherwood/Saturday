/* wild: 10 кругов «безумных» идей поверх combo4 (P.base + отложенная паника Boost(2, k 0)).
   Свой движок — копия panicx_sim.edge с «крючками» (hk), чтобы проверять механизмы, которых нет в правилах:
     hk.init(X) → состояние монеты (s), один раз на прогон;
     hk.act({X, i, j, q, a, R, s, units, cash, p, before}) → новое действие a (доля как в правилах: <0 — продать −a монеты, >1 — купить (a−1) резерва);
     hk.after({X, i, j, q, a, s, units, cash, p, sold, bought}) — после сделки (для памяти/обучения);
     hk.extra({X, i, j, q, a, s, units, cash, p}) → {sell: доля монеты} | {buy: доля резерва} — доп. сделка в день без сигнала (q < 0 или a = base).
   Всё по прошлым данным: решение по вчерашнему дню j = i − 1 − lag, худший из двух сдвигов (0/1).
   Ансамбль: evc(S, pol, hk, lists, {ens: [[S1,pol1,hk1], …]}) — монета делится на равные «подсчета», итог = сумма.
   Использование: const W = require('./wild_sim.js'); W.report('имя', S, pol, hk) */
const H2 = require('./panicx_p2.js'), P = H2.P, Z = H2.Z;
const FEE = 0.001, UNIT = 10;
const POL = H2.Boost(2, { k: 0 });
const BASE = P.base;
const G = P.load();
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, p: P.isP(r), cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
function edge(X, S, lag, part = 'full', rec = false, pol = POL, hk = null) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), I = X.ind, s = hk && hk.init ? hk.init(X, S) : {};
  let cash = 0, units = 0, du = 0, st = { owed: 0, spent: 0, r0: 0, ep: -1 }; const tr = rec ? [] : null;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    let a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    if (hk && hk.act && j >= 0) a = hk.act({ X, i, j, q, a, R, s, units, cash, p, before });
    cash += UNIT;
    if (pol && j >= 0 && I.pday[j] === 1 && st.ep !== j) st = { owed: 0, spent: 0, r0: before, ep: j, oo: st.oo || 0 };
    let sold = 0, bought = 0;
    if (a < 0) { const amt = Math.min(1, -a) * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); sold = amt; if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) {
      let want, pan = false, rel = 0;
      if (pol && pol.buy && q >= 0 && R[q].p && a > 1) { /* доля паники могла быть изменена крючком — откладывается изменённая доля */ const share = a - 1, fr = Math.min(share, Math.max(0, pol.buy({ X, j, share, before, st }))); want = UNIT + fr * before; st.owed = Math.min(before + UNIT - want, st.owed + (share - fr) * before); pan = true; }
      else { want = UNIT + (a - 1) * before; pan = q >= 0 && R[q].p; }
      if (pol && pol.release && st.owed > 0 && j >= 0) { const k = pol.release({ X, j, before, st }); if (k > 0) { rel = Math.min(1, k) * st.owed; st.owed -= rel; } }
      if (pol && pol.extra && j >= 0) { const k = pol.extra({ X, j, before, st }); if (k > 0) rel += Math.min(1, k) * before; }
      const amt = Math.min(cash, want + rel); units += (amt * (1 - FEE)) / p; cash -= amt; bought = amt - UNIT;
      if (pan || rel) st.spent += amt - UNIT;
      if (rec && amt > UNIT + 1e-9) tr.push({ i, s: 1, amt: amt - UNIT, p, q, pan: pan || rel > 0 });
      if (hk && hk.extra && j >= 0 && (q < 0 || Math.abs(a - S.base) < 1e-12) && !rel) {
        const x = hk.extra({ X, i, j, q, a, s, units, cash, p });
        if (x && x.sell > 0) { const v = Math.min(1, x.sell) * units * p; units -= v / p; cash += v * (1 - FEE); sold += v; if (rec) tr.push({ i, s: -1, amt: v, p, q: -9 }); }
        else if (x && x.buy > 0) { const v = Math.min(1, x.buy) * cash; units += (v * (1 - FEE)) / p; cash -= v; bought += v; if (rec) tr.push({ i, s: 1, amt: v, p, q: -9 }); }
      }
    }
    if (hk && hk.after && j >= 0) hk.after({ X, i, j, q, a, s, units, cash, p, sold, bought });
    if (pol && j >= 0 && I.pend[j]) st.owed = 0;
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, fin, dca, tr };
}
// ансамбль: список [S, pol, hk] — каждая копия получает 1/K взноса (итог и DCA складываются)
function edgeE(X, ens, lag, part) { let f = 0, d = 0; for (const [S, pol, hk] of ens) { const r = edge(X, S, lag, part, false, pol, hk); f += r.fin; d += r.dca; } return (f / d - 1) * 100; }
const E = (X, S, part, pol, hk, ens) => ens ? Math.min(edgeE(X, ens, 0, part), edgeE(X, ens, 1, part)) : Math.min(edge(X, S, 0, part, false, pol, hk).e, edge(X, S, 1, part, false, pol, hk).e);
function evc(S, pol = POL, hk = null, lists = ['sel', 'ex', 'rnd'], ens = null) { const o = {}; for (const g of lists) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: E(X, S, 'full', pol, hk, ens), h1: E(X, S, 'h1', pol, hk, ens), h2: E(X, S, 'h2', pol, hk, ens) })); return o; }
const f = P.f;
let B = null, B100 = null;
const base = () => { if (!B) { B = evc(BASE, POL, null); B.S = Z.sum(B); } return B; };
const base100 = () => { if (!B100) B100 = evc(BASE, POL, null, ['n100']); return B100; };
function why(RS, BS) { return Z.SEGS.map((s) => { const w = Z.strict(RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); }
const rows = [];
// отчёт к combo4: медианы, доход по сегментам, строгая (✔/✗ по сегментам), причины провала; o.n100 — 100 новых (средний лог по монетам, лучше/хуже)
function report(nm, S = BASE, pol = POL, hk = null, o = {}) {
  const b = base(), R = evc(S, pol, hk, ['sel', 'ex', 'rnd'], o.ens), RS = Z.sum(R);
  const inc = Object.fromEntries(Z.SEGS.map((s) => [s, Z.inc(RS, s) - Z.inc(b.S, s)])), ok = Object.fromEntries(Z.SEGS.map((s) => [s, !Z.strict(RS, b.S, s).length]));
  const all = Z.SEGS.every((s) => ok[s]), w = why(RS, b.S);
  let n = '', N = null;
  if (o.n100) {
    const b1 = base100(), R1 = evc(S, pol, hk, ['n100'], o.ens), s1 = Z.sum(R1), m = Z.mlog(R1, b1, 'all', ['n100']);
    const sg = ['alt', 'meme'].map((s) => { const q = Z.mlog(R1, b1, s, ['n100']); return `${s} ${q.m.toFixed(4)} ${q.u}/${q.d}`; }).join(', ');
    N = { s1, m, R1 }; n = ` | 100н ${f(s1.n100.all)} (осн ${f(Z.sum(b1).n100.all)}) лог ${m.m >= 0 ? '+' : ''}${m.m.toFixed(4)} ${m.u}/${m.d} [${sg}]`;
  }
  const line = `${nm.padEnd(34)} ${['sel', 'ex', 'rnd'].map((g) => f(RS[g].all)).join(' | ')} | ${Z.SEGS.map((s) => `${({all:'всё',big:'к',alt:'а',meme:'м'})[s]}${inc[s] >= 0 ? '+' : ''}${inc[s].toFixed(3)}${ok[s] ? '✔' : '✗'}`).join(' ')}${n}${w ? ' || ' + w.slice(0, 170) : ''}`;
  if (!o.quiet) console.log(line);
  const r = { nm, R, RS, inc, ok, all, d: inc.all, w, N, line }; rows.push(r); return r;
}
const summary = (a = rows) => { const ds = a.map((x) => x.d).sort((x, y) => x - y); return `вариантов ${a.length}, в плюсе ${ds.filter((d) => d > 0).length}, ✔ строгая ${a.filter((x) => x.all).length}; доход мин ${ds[0].toFixed(3)} мед ${ds[ds.length >> 1].toFixed(3)} макс ${ds[ds.length - 1].toFixed(3)}`; };
const clone = P.clone;
const isSell = (r) => r.act < 0;
// класс правила продажи (страх, сильный страх, фандинг, тихая вершина, широкая вершина, памп, альтсезон)
function cls(r) {
  if (r.act >= 0) return null; const h = (k) => r.conds.some((c) => c.ind === k);
  if (h('fng') && r.conds.some((c) => c.ind === 'fng' && c.v === 40)) return 'fear40';
  if (h('fng') && r.conds.some((c) => c.ind === 'fng' && c.v === 52)) return 'fear52';
  if (h('fund30')) return 'fund'; if (h('qt')) return 'qt'; if (h('btcath')) return h('up90') ? 'pump' : 'wide'; if (h('fng')) return 'as'; return 'other';
}
// общий доступ ко всем монетам (для межмонетных индикаторов)
module.exports = { P, Z, H2, G, POL, BASE, edge, evc, report, rows, summary, clone, base, base100, f, cls, why, decide, compile };
if (require.main === module) {
  const r = report('combo4 (сверка)', BASE, POL, null, { n100: true });
  const R0 = P.evc(BASE, POL, ['sel', 'ex', 'rnd']); let mx = 0; for (const g in R0) R0[g].forEach((x, i) => { for (const k of ['f', 'h1', 'h2']) mx = Math.max(mx, Math.abs(x[k] - r.R[g][i][k])); });
  console.log('макс. расхождение с panicx_sim по монетам/половинам:', mx.toExponential(2));
}
