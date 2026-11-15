/* panicx: точнее покупки «паники в стейблах» поверх combo3 без tune1 (found/combo3-best.json = combo3_sim.make({simp,t2,t3})).
   Свой движок (копия agent_sim.edge без шортов/модов) с «политикой» для правил паники: можно откладывать часть покупки в «долг»
   и тратить его при подтверждении / в конце эпизода, ограничивать деньги на эпизод и т. п. Всё по прошлым данным, решение по вчерашнему дню.
   Индикаторы эпизода паники (паника = usdt > 1,07 и othd < 25, как panicd; эпизод — дни паники с разрывами ≤ GAP дней):
     pday — день эпизода (0 — не паника), pdrop — падение монеты от закрытия первого дня эпизода, %, bdrop — то же у BTC,
     pmin — рост монеты от минимума эпизода, %, pupk — usdt к максимуму usdt в эпизоде, pend — эпизод закончился (GAP дней без паники).
   Использование: const P = require('./panicx_sim.js'); P.report(имя, S, pol) */
const Z = require('./combo2_sim.js'), C3 = require('./combo3_sim.js');
const FEE = 0.001, UNIT = 10, H = 120, GAP = 10;
const base = C3.make({ simp: 1, t2: 1, t3: 1 });
const isP = (r) => r.act > 1.0001 && r.conds.some((c) => c.ind === 'usdt');
let G = null;
function load() {
  if (G) return G;
  G = Z.load(['sel', 'ex', 'rnd', 'n100']);
  for (const g in G) for (const X of G[g]) episodes(X);
  return G;
}
function rsiOf(c, n, w = 14) {
  const o = new Float64Array(n).fill(NaN); let ag = 0, al = 0;
  for (let i = 1; i < n; i++) {
    const d = c[i] - c[i - 1], g = Math.max(d, 0), l = Math.max(-d, 0);
    if (!isFinite(d)) { o[i] = o[i - 1]; continue; }
    if (i <= w) { ag += g / w; al += l / w; if (i === w) o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); }
    else { ag = (ag * (w - 1) + g) / w; al = (al * (w - 1) + l) / w; o[i] = 100 - 100 / (1 + ag / (al || 1e-12)); }
  }
  return o;
}
function episodes(X) {
  const n = X.n, I = X.ind, c = X.c, b = I.btcp;
  const pday = new Float64Array(n), pdrop = new Float64Array(n).fill(NaN), bdrop = new Float64Array(n).fill(NaN), pmin = new Float64Array(n).fill(NaN), pupk = new Float64Array(n).fill(NaN), pend = new Float64Array(n);
  let st = -1, last = -1e9, mn = Infinity, uk = 0;
  for (let i = 0; i < n; i++) {
    const on = I.usdt[i] > 1.07 && I.othd[i] < 25;
    if (on) { if (i - last > GAP) { st = i; mn = Infinity; uk = 0; } last = i; }
    if (st >= 0 && i - last <= GAP) {
      if (c[i] < mn) mn = c[i]; if (I.usdt[i] > uk) uk = I.usdt[i];
      pday[i] = on ? i - st + 1 : 0; // 0 — в разрыве
      pdrop[i] = (1 - c[i] / c[st]) * 100; bdrop[i] = b && b[st] > 0 ? (1 - b[i] / b[st]) * 100 : NaN;
      pmin[i] = (c[i] / mn - 1) * 100; pupk[i] = I.usdt[i] / uk;
      pend[i] = !on && i - last === GAP ? 1 : 0;
    }
  }
  Object.assign(I, { pday, pdrop, bdrop, pmin, pupk, pend });
  if (b) { const bb = Float64Array.from(b); for (let i = 1; i < n; i++) if (!isFinite(bb[i])) bb[i] = bb[i - 1]; I.brsi = rsiOf(bb, n); }
}
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, p: isP(r), cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
/* pol — политика для правил паники (необязательно):
   pol.buy(ctx) → доля резерва, которую правило паники тратит сегодня (share = act − 1 по умолчанию); остаток (share − доля) × before уходит в «долг», $
   pol.release(ctx) → доля долга (0…1), которая тратится сегодня (вызывается в любой день покупки/взноса, не в день продажи)
   ctx: {X, j (день решения), share, before, st: {owed $, spent $, r0 — резерв на старте эпизода}}. Долг сгорает (остаётся в резерве) в конце эпизода (pend), если release его не потратил. */
function edge(X, S, lag, part = 'full', rec = false, pol = null) {
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), I = X.ind;
  let cash = 0, units = 0, du = 0, st = { owed: 0, spent: 0, r0: 0, ep: -1 }; const tr = rec ? [] : null;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    const a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    cash += UNIT;
    if (pol && j >= 0 && I.pday[j] === 1 && st.ep !== j) st = { owed: 0, spent: 0, r0: before, ep: j };
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); if (rec) tr.push({ i, s: -1, amt, p, q }); } }
    else if (a > 0) {
      let want, pan = false, rel = 0;
      if (pol && q >= 0 && R[q].p) { const share = a - 1, fr = Math.min(share, Math.max(0, pol.buy({ X, j, share, before, st }))); want = UNIT + fr * before; st.owed = Math.min(before + UNIT - want, st.owed + (share - fr) * before); pan = true; }
      else { want = UNIT + (a - 1) * before; pan = q >= 0 && R[q].p; }
      if (pol && pol.release && st.owed > 0 && j >= 0) { const k = pol.release({ X, j, before, st }); if (k > 0) { rel = Math.min(1, k) * st.owed; st.owed -= rel; } }
      const amt = Math.min(cash, want + rel); units += (amt * (1 - FEE)) / p; cash -= amt;
      if (pan || rel) st.spent += amt - UNIT;
      if (rec && amt > UNIT + 1e-9) tr.push({ i, s: 1, amt: amt - UNIT, p, q, pan: pan || rel > 0 });
    }
    if (pol && j >= 0 && I.pend[j]) st.owed = 0;
  }
  const dca = du * c[b - 1], fin = units * c[b - 1] + cash;
  return { e: (fin / dca - 1) * 100, tr };
}
const E = (X, S, part, pol) => Math.min(edge(X, S, 0, part, false, pol).e, edge(X, S, 1, part, false, pol).e);
function evc(S, pol, lists = ['sel', 'ex', 'rnd']) { load(); const o = {}; for (const g of lists) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: E(X, S, 'full', pol), h1: E(X, S, 'h1', pol), h2: E(X, S, 'h2', pol) })); return o; }
// метрика точности паники: покупки правил паники и выдачи долга — падение после покупки до минимума следующих 120 дней (взвеш. по деньгам), медиана дней до дна (взвеш.), доля денег при падении > 30%
function metric(S, pol, lists = ['sel', 'ex', 'rnd']) {
  load(); let W = 0, wf = 0, big = 0; const md = [], pc = [], pd = [];
  for (const g of lists) for (const X of G[g]) {
    const { tr } = edge(X, S, 0, 'full', true, pol); let w = 0, s = 0, sd = 0;
    for (const t of tr) if (t.s > 0 && t.pan && t.i + H < X.n) {
      let m = t.p, d = 0; for (let k = t.i; k <= t.i + H; k++) if (X.c[k] < m) { m = X.c[k]; d = k - t.i; }
      const fl = (1 - m / t.p) * 100; W += t.amt; wf += t.amt * fl; if (fl > 30) big += t.amt; md.push([d, t.amt]); w += t.amt; s += t.amt * fl; sd += t.amt * d;
    }
    if (w > 0) { pc.push(s / w); pd.push(sd / w); }
  }
  md.sort((x, y) => x[0] - y[0]); let cc = 0, wd = NaN; for (const [d, w] of md) { cc += w; if (cc >= W / 2) { wd = d; break; } }
  // fallC / daysC — среднее по монетам (у каждой монеты падение и дни взвешены по её деньгам): крупнейшие резервы не решают всё
  return { fall: wf / W, big: (100 * big) / W, days: wd, W, fallC: pc.reduce((a, b) => a + b, 0) / pc.length, daysC: pd.reduce((a, b) => a + b, 0) / pd.length };
}
const f = (s) => `${Math.round(s.med)}/${s.pos}/${s.hpos}/${s.hworst.toFixed(1)}`;
let BR = null, BS = null, BM = null;
function baseline() { if (!BR) { BR = evc(base, null); BS = Z.sum(BR); BM = metric(base, null); } return { BR, BS, BM }; }
let B100 = null;
// сравнение с основой: строка отчёта (медиана/в плюсе/половин/худшая половина по группам | доход по сегментам и строгая | метрика паники)
function report(nm, S, pol, { n100 = false, quiet = false } = {}) {
  baseline();
  const lists = ['sel', 'ex', 'rnd'], R = evc(S, pol, lists), RS = Z.sum(R), M = metric(S, pol);
  const segs = Z.SEGS.map((s) => `${s} ${(Z.inc(RS, s) - Z.inc(BS, s)).toFixed(3)}${Z.strict(RS, BS, s).length ? '✗' : '✔'}`).join(' ');
  let n = '', N = null;
  if (n100) {
    if (!B100) B100 = evc(base, null, ['n100']);
    const R1 = evc(S, pol, ['n100']), s1 = Z.sum(R1), b1 = Z.sum(B100), m = Z.mlog(R1, B100, 'all', ['n100']);
    const sg = ['big', 'alt', 'meme'].map((s) => { const q = Z.mlog(R1, B100, s, ['n100']); return `${s} ${q.m.toFixed(4)} ${q.u}/${q.d}`; }).join(', ');
    N = { s1, b1, m }; n = ` | 100н ${f(s1.n100.all)} (осн ${f(b1.n100.all)}) лог ${m.m.toFixed(4)} лучше/хуже ${m.u}/${m.d} [${sg}]`;
  }
  const line = `${nm.padEnd(30)} ${lists.map((g) => f(RS[g].all)).join(' | ')} | ${segs} | паника ${M.fall.toFixed(1)}%/${M.days}д/${M.big.toFixed(0)}%>30 монеты ${M.fallC.toFixed(1)}%/${M.daysC.toFixed(0)}д${n} ${Z.strict(RS, BS, 'all').join(',')}`;
  if (!quiet) console.log(line);
  return { R, RS, M, N, line, d: Z.inc(RS, 'all') - Z.inc(BS, 'all'), ok: Z.SEGS.every((s) => !Z.strict(RS, BS, s).length) };
}
const clone = C3.clone;
// правила паники: f(r) → массив правил вместо r
function mapP(fn) { const S = clone(base); S.rules = S.rules.flatMap((r) => (isP(r) ? fn(r) : [r])); return S; }
module.exports = { Z, C3, base, isP, load, edge, E, evc, metric, report, baseline, mapP, clone, f, episodes };
