/* imp9: хедж вместо продажи (по монетам). Копия edge() из agent_sim.js с режимами:
   mode 'sell' — как в основе (продажа доли монеты, деньги в резерв);
   mode 'own'  — вместо продажи шорт перпа той же монеты на ту же сумму (спот остаётся), закрытие всего хеджа на первом сигнале покупки (правило с act > 1);
   mode 'btc'  — то же, но шорт перпа BTC на ту же сумму в долларах;
   mode 'mix'  — шорт своей монеты, если у неё есть перп (есть ряд фандинга на эту дату), иначе шорт BTC.
   Фандинг: ряды agent3-coin-funding.json (% в день; шорт получает f > 0, платит f < 0); до начала ряда — 0. Комиссия перпа 0,045%.
   Ликвидация по правилам Hyperliquid: залог перпов — только USDC (резерв монеты) + нереализованный PnL перпов, монеты на споте НЕ считаются;
   ликвидация, когда стоимость счёта перпов ≤ поддерживающей маржи (BTC 1,25%, ETH 2%, остальные 5% номинала) по максимуму дня (×hs в стрессе).
   Использование: const H = require('./imp9_sim.js'); const G = H.groups(); H.evalH(G, S, {mode:'own'}) */
const K = require('./combo_sim.js');
const fs = require('fs');
const AUX = JSON.parse(fs.readFileSync(process.env.IMP9_AUX || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_aux.json', 'utf8'));
const FEE = 0.001, UNIT = 10;
const BH = new Map(); AUX.btc.t.forEach((t, i) => BH.set(t, [AUX.btc.c[i], AUX.btc.h[i]]));
const FM = {}; for (const k in AUX.fund) { const m = new Map(); AUX.fund[k].t.forEach((t, i) => m.set(t, AUX.fund[k].f[i])); FM[k] = m; }
const MM = (nm) => (nm === 'BTC' ? 0.0125 : nm === 'ETH' ? 0.02 : 0.05);
function aux(X) {
  if (X.aux) return X.aux;
  const n = X.n, bc = new Float64Array(n), bh = new Float64Array(n), fc = new Float64Array(n), fb = new Float64Array(n);
  const own = FM[X.name], btc = FM.BTC;
  for (let i = 0; i < n; i++) {
    const b = BH.get(X.t[i]) || [NaN, NaN]; bc[i] = b[0]; bh[i] = b[1];
    const f = own ? own.get(X.t[i]) : undefined; fc[i] = f == null ? NaN : f;
    const g = btc.get(X.t[i]); fb[i] = g == null ? 0 : g;
  }
  // перп монеты «есть» с первого дня ряда фандинга (пропуски внутри ряда — фандинг 0)
  let first = -1; for (let i = 0; i < n; i++) if (!isNaN(fc[i])) { first = i; break; }
  const hasPerp = new Uint8Array(n); if (first >= 0) for (let i = first; i < n; i++) { hasPerp[i] = 1; if (isNaN(fc[i])) fc[i] = 0; }
  return (X.aux = { bc, bh, fc, fb, hasPerp });
}
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) {
  for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; }
  return -1;
}
// o: {mode, fp (комиссия перпа), hs (стресс максимумов), fund (false — без фандинга), closeOn (функция правила: закрывать хедж), cap (макс. доля хеджа)}
function edgeH(X, S, lag, part = 'full', o = {}) {
  const mode = o.mode || 'sell', FP = o.fp == null ? 0.00045 : o.fp, hs = o.hs || 1, useF = o.fund !== false;
  let a0 = 0, b = X.n; if (part === 'h1') b = Math.floor(X.n / 2); if (part === 'h2') a0 = Math.floor(X.n / 2);
  const c = X.c, R = compile(X, S.rules), A = aux(X), mmo = MM(X.name), closeOn = o.closeOn || ((r) => r.act > 1);
  const CL = R.map((r) => closeOn(r.r));
  let cash = 0, units = 0, du = 0, h = 0, hc = 0, hb = 0, hbc = 0, w = 0, liq = 0, fpnl = 0, hpnl = 0, nH = 0, minM = 1e9;
  for (let i = a0; i < b; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2;
    const a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    const bp = A.bc[i];
    if (useF) { if (h > 0) { const v = h * p * (isNaN(A.fc[i]) ? A.fb[i] : A.fc[i]) / 100; cash += v; fpnl += v; } if (hb > 0) { const v = hb * bp * A.fb[i] / 100; cash += v; fpnl += v; } }
    if (q >= 0 && CL[q] && (h > 0 || hb > 0)) {          // закрыть весь хедж на сигнале покупки
      const v = hc - h * p * (1 + FP) + (hb > 0 ? hbc - hb * bp * (1 + FP) : 0); cash += v; hpnl += v; h = 0; hc = 0; hb = 0; hbc = 0; w = 0;
    }
    const before = cash; cash += UNIT;
    if (a < 0) {
      const f = -a;
      if (mode === 'sell') { const amt = f * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); } }
      else {
        const own = mode === 'own' ? A.hasPerp[i] || !o.ownOnly : mode === 'mix' ? A.hasPerp[i] : false;
        const Hv = h * p + (hb > 0 ? hb * bp : 0), nv = f * Math.max(units * p - Hv, 0);
        if (nv > 0) {
          // хедж не больше, чем позволяет залог USDC: резерв (с выручкой проданной части) ≥ cov × весь номинал хеджа; остаток — обычная продажа
          let hn = nv;
          if (o.cov) hn = Math.max(0, Math.min(nv, (cash + nv * (1 - FEE) - o.cov * Hv) / (o.cov + 1 - FEE)));
          if (!own && isNaN(bp)) hn = 0;
          const sold = nv - hn; if (sold > 0) { units -= sold / p; cash += sold * (1 - FEE); }
          if (hn > 0) { if (own) { h += hn / p; hc += hn * (1 - FP); } else { hb += hn / bp; hbc += hn * (1 - FP); } nH++; }
        }
      }
    } else if (a > 0) { const amt = Math.min(Math.max(cash, 0), UNIT + (a - 1) * Math.max(before, 0)); units += (amt * (1 - FEE)) / p; cash -= amt; }
    if (h > 0 || hb > 0) {
      const hi = Math.min(Math.max(X.h[i] || p, p), 2 * Math.max(p, c[i - 1] || p)) * hs, bhi = (isNaN(A.bh[i]) ? bp : A.bh[i]) * hs;
      const acct = cash + hc - h * hi + (hb > 0 ? hbc - hb * bhi : 0), mm = mmo * h * hi + 0.0125 * hb * bhi, ratio = acct / (h * hi + hb * bhi);
      if (ratio < minM) minM = ratio;
      if (acct <= mm && !o.noLiq) { liq++; cash = Math.max(acct - mm, 0); h = 0; hc = 0; hb = 0; hbc = 0; w = 0; }
    }
  }
  const cl = c[b - 1], bcl = A.bc[b - 1];
  const dca = du * cl, fin = units * cl + cash + hc - h * cl + (hb > 0 ? hbc - hb * bcl : 0);
  return { e: (fin / dca - 1) * 100, liq, fpnl: fpnl / dca * 100, hpnl, nH, minM };
}
const med = K.med;
function evalH(G, S, o = {}, groups = ['sel', 'ex', 'rnd']) {
  const out = { liq: 0, liqS: 0, minM: 1e9, fund: [] };
  for (const g of groups) {
    if (!G[g]) continue;
    const E = (X, part) => { let m = Infinity; for (const lag of [0, 1]) { const r = edgeH(X, S, lag, part, o); m = Math.min(m, r.e); out.liq += r.liq; if (part === 'full') { out.minM = Math.min(out.minM, r.minM); if (lag === 0) out.fund.push(r.fpnl); } if (o.mode && o.mode !== 'sell' && part === 'full') for (const hs of [1.2, 1.3]) out.liqS += edgeH(X, S, lag, part, { ...o, hs }).liq; } return m; };
    const full = G[g].map((X) => E(X, 'full')), halves = G[g].flatMap((X) => [E(X, 'h1'), E(X, 'h2')]);
    out[g] = { ...K.stat(full, halves), e: full };
  }
  out.fundMed = med(out.fund);
  return out;
}
const row = (tag, r, b) => `${K.passes(r, b) ? '✔' : '·'} ${(K.inc(r) - K.inc(b) >= 0 ? '+' : '') + (K.inc(r) - K.inc(b)).toFixed(3)} | ${K.line(r)}` +
  (r.n100 ? ` | 100н ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos}` : '') + ` | ликв ${r.liq}, стресс ${r.liqS}, мин.запас ${r.minM < 1e8 ? r.minM.toFixed(2) : '—'}, фандинг мед ${r.fundMed.toFixed(1)}% | ${tag}` +
  (K.passes(r, b) ? '' : ` [${K.why(r, b)}]`);
const groups = (list = ['sel', 'ex', 'rnd']) => { const G = K.groups(list); K.prep(G); return G; };
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const SB = { base: BEST.base, rules: BEST.rules };
module.exports = { K, edgeH, evalH, row, groups, SB, aux, decide, compile };
