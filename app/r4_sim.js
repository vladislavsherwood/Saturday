/* r4: копия движка panicx_sim.edge (отложенная паника через pol) с крючками и записью сделок по правилам.
   hk.sell(ctx) → множитель доли продажи (ctx: {X, j, i, r — правило, a — доля, units, cash, p — цена дня сделки НЕ использовать для решения; share — доля монеты в портфеле по цене дня решения j})
   hk.act(ctx) → новое действие дня (ctx.a — действие по правилам; можно превратить день взноса в продажу: вернуть −доля); hk.buyk(ctx) → множитель доли резерва у покупки не-паники. Без крючков совпадает с panicx_sim.edge (проверка: node r4_sim.js).
   Использование: const R4 = require('./r4_sim.js'); R4.evc(S, pol, hk) */
const L = require('./r4_lib.js'), { P, Z, G } = L;
const FEE = 0.001, UNIT = 10;
const isP = P.isP;
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, p: isP(r), cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
function edge(X, S, lag, part = 'full', rec = false, pol = null, hk = null) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), I = X.ind;
  let cash = 0, units = 0, du = 0, st = { owed: 0, spent: 0, r0: 0, ep: -1 }; const tr = rec ? [] : null; const mem = {};
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    let a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    cash += UNIT;
    if (pol && j >= 0 && I.pday[j] === 1 && st.ep !== j) st = { owed: 0, spent: 0, r0: before, ep: j, oo: st.oo || 0 };
    if (hk && hk.act && j >= 0) a = hk.act({ X, j, i, q, r: q >= 0 ? R[q].r : null, a, units, cash: before, mem });
    if (a < 0 && hk && hk.sell && j >= 0) { const pj = c[j], share = (units * pj) / (units * pj + before || 1); a *= hk.sell({ X, j, i, r: R[q].r, a, units, cash: before, share, mem }); if (!(a < 0)) a = 1; }
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (rec) tr.push({ i, j, s: -1, amt, p, r: R[q].r }); } }
    else if (a > 0) {
      let want, pan = false, rel = 0;
      if (pol && pol.buy && q >= 0 && R[q].p) { const share = a - 1, fr = Math.min(share, Math.max(0, pol.buy({ X, j, share, before, st }))); want = UNIT + fr * before; st.owed = Math.min(before + UNIT - want, st.owed + (share - fr) * before); pan = true; }
      else { let sh = a - 1; if (hk && hk.buyk && q >= 0 && sh > 0) sh = Math.min(1, sh * hk.buyk({ X, j, i, r: R[q].r, mem })); want = UNIT + sh * before; pan = q >= 0 && R[q].p; }
      if (pol && pol.release && st.owed > 0 && j >= 0) { const k = pol.release({ X, j, before, st }); if (k > 0) { rel = Math.min(1, k) * st.owed; st.owed -= rel; } }
      if (pol && pol.extra && j >= 0) { const k = pol.extra({ X, j, before, st }); if (k > 0) rel += Math.min(1, k) * before; }
      const amt = Math.min(cash, want + rel); units += (amt * (1 - FEE)) / p; cash -= amt;
      if (pan || rel) st.spent += amt - UNIT;
      if (rec && amt > UNIT + 1e-9) tr.push({ i, j, s: 1, amt: amt - UNIT, p, r: q >= 0 ? R[q].r : null, pan: pan || rel > 0, rel: rel > 0 });
    }
    if (pol && j >= 0 && I.pend[j]) st.owed = 0;
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, tr };
}
const E = (X, S, part, pol, hk) => Math.min(edge(X, S, 0, part, false, pol, hk).e, edge(X, S, 1, part, false, pol, hk).e);
function evc(S, pol, hk, lists = ['sel', 'ex', 'rnd']) { const o = {}; for (const g of lists) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: E(X, S, 'full', pol, hk), h1: E(X, S, 'h1', pol, hk), h2: E(X, S, 'h2', pol, hk) })); return o; }
let B = null, B1 = null;
// отчёт к combo4 (как L.run), но с крючками
function run(nm, S = L.S0, pol = L.pol0, hk = null, { n100 = false, quiet = false } = {}) {
  if (!B) B = evc(L.S0, L.pol0, null);
  const R = evc(S, pol, hk), RS = Z.sum(R), BS = Z.sum(B);
  const w = Z.SEGS.map((s) => { const x = Z.strict(RS, BS, s); return x.length ? `${s}: ${x.join(',')}` : ''; }).filter(Boolean).join(' | ');
  const d = (s) => Z.inc(RS, s) - Z.inc(BS, s); const dseg = { all: d('all'), big: d('big'), alt: d('alt'), meme: d('meme') };
  let n = '', n1 = null;
  if (n100) { if (!B1) B1 = evc(L.S0, L.pol0, null, ['n100']); const R1 = evc(S, pol, hk, ['n100']), s1 = Z.sum(R1), m = Z.mlog(R1, B1, 'all', ['n100']); n1 = { med: s1.n100.all.med, pos: s1.n100.all.pos, hpos: s1.n100.all.hpos, m: m.m, u: m.u, d: m.d, R1 }; n = ` | 100н ${P.f(s1.n100.all)} лог ${L.sg(m.m)} ${m.u}/${m.d}`; }
  const txt = `${nm.padEnd(44)} ${['sel', 'ex', 'rnd'].map((g) => P.f(RS[g].all)).join(' | ')} | ${L.sg(dseg.all)} к ${L.sg(dseg.big)} а ${L.sg(dseg.alt)} м ${L.sg(dseg.meme)} ${w ? '✗' : '✔'}${n}${w ? ' | ' + w.slice(0, 200) : ''}`;
  if (!quiet) console.log(txt);
  return { R, RS, w, d: dseg.all, dseg, n100: n1, txt };
}
module.exports = { edge, E, evc, run };
if (require.main === module) { // сверка с panicx_sim.edge
  let mx = 0; for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) for (const part of ['full', 'h1', 'h2']) for (const lag of [0, 1]) mx = Math.max(mx, Math.abs(edge(X, L.S0, lag, part, false, L.pol0).e - P.edge(X, L.S0, lag, part, false, L.pol0).e));
  console.log('макс. расхождение с panicx_sim.edge, п. п.:', mx);
}
