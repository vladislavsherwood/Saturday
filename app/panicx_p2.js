/* panicx, вторая серия (круги 11–20): помощники. Основа — финалист panicx-best (A 540, t 0,98, k 0,25, rv 0,965, сильная паника не откладывается).
   Pol2 — обобщённая «отложенная паника»:
     gate: кому откладывать — 'age' (age > A), 'none', 'eps' (монета уже видела ≥ E эпизодов паники до текущего), 'vol' (vol180 < V), 'len' (age > A2 ИЛИ eps)
     k: доля сразу; kf/sp — если usdt вырос за 7 дней больше чем на sp (usdt7 > 1 + sp), доля kf (сильнее рост — больше откладываем)
     выдача: r1 — доля долга на первом развороте (upk10 < rv), остаток — по second ('deep' upk10 < rv2, 'liq' oidd30 < −28, 'cap' fng < 10, 'fear' fngd7 > fv, 'oi' oic7 > 0, 'none')
             или в конце эпизода. Флаг «первый разворот» сбрасывается, когда usdt снова у пика (upk10 ≥ t).
   Индикаторы (только прошлое): upk10 = usdt / max usdt за 10 дн (pk — окно 5/7/14/20: upkN); usdt7 = usdt / usdt 7 дн назад; epn — сколько эпизодов паники началось раньше текущего. */
const P = require('./panicx_sim.js'), Z = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) {
  const I = X.ind, u = I.usdt, n = X.n;
  if (!I.upk10) { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } I.upk10 = a; }
  for (const N of [5, 7, 14, 20]) { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let k = Math.max(0, i - N + 1); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } I['upk' + N] = a; }
  const a7 = new Float64Array(n).fill(NaN); for (let i = 7; i < n; i++) a7[i] = u[i] / u[i - 7]; I.usdt7 = a7;
  const ep = new Float64Array(n); let cnt = 0; for (let i = 0; i < n; i++) { if (I.pday[i] === 1) cnt++; ep[i] = Math.max(0, cnt - 1); } I.epn = ep;
}
const BEST1 = { A: 540, t: 0.98, k: 0.25, rv: 0.965, su: 1.2 };
function gateOf(o, I, j) {
  switch (o.gate || 'age') {
    case 'none': return true;
    case 'age': return I.age[j] > o.A;
    case 'eps': return I.epn[j] >= o.E;
    case 'vol': return I.vol180[j] < o.V;
    case 'len': return I.age[j] > o.A || I.epn[j] >= o.E;
    default: return true;
  }
}
function second(o, I, j) {
  switch (o.sec || 'none') {
    case 'deep': return I.upk10[j] < o.rv2;
    case 'liq': return I.oidd30[j] < -28;
    case 'cap': return I.fng[j] < 10;
    case 'fear': return I.fngd7[j] > o.fv;
    case 'oi': return I.oic7[j] > 0;
    default: return false;
  }
}
function Pol2(opt = {}) {
  const o = { ...BEST1, gate: 'age', r1: 1, ...opt };
  return {
    buy: ({ X, j, share }) => {
      const I = X.ind;
      if (I.usdt[j] > o.su) return share;
      if (!gateOf(o, I, j) || !(I[o.pk || 'upk10'][j] >= o.t)) return share;
      if (o.sp != null && I.usdt7[j] > 1 + o.sp) return share * o.kf;
      return share * o.k;
    },
    release: ({ X, j, st }) => {
      const I = X.ind;
      if (I.pend[j]) return 1;
      const U = I[o.pk || 'upk10'];
      if (U[j] >= o.t) st.hit = false;
      if (o.r1 < 1 && second(o, I, j)) return 1;
      if (U[j] < o.rv) { if (o.r1 >= 1) return 1; if (!st.hit) { st.hit = true; return o.r1; } }
      return 0;
    },
  };
}
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
// к combo3 без tune1 (C3) — отдельно запомненная сумма
let C3S = null; const c3 = () => { if (!C3S) C3S = Z.sum(P.evc(P.base, null)); return C3S; };
const rows = [];
function run(nm, pol, S = P.base) {
  const r = P.report(nm, S, pol, { quiet: true }), w = why(r), d3 = Z.inc(r.RS, 'all') - Z.inc(c3(), 'all'), w3 = Z.SEGS.some((s) => Z.strict(r.RS, c3(), s).length);
  console.log(`${nm.padEnd(40)} ${['sel', 'ex', 'rnd'].map((g) => Math.round(r.RS[g].all.med)).join(' / ')} к panicx ${r.d >= 0 ? '+' : ''}${r.d.toFixed(3)} ${w ? '✗' : '✔'} | к C3 ${d3 >= 0 ? '+' : ''}${d3.toFixed(3)}${w3 ? '✗' : '✔'} | паника ${r.M.fall.toFixed(1)}%/${r.M.days}д/${r.M.big.toFixed(0)}% монеты ${r.M.fallC.toFixed(1)}%/${r.M.daysC.toFixed(0)}д | ${w.slice(0, 150)}`);
  rows.push({ nm, d: r.d, ok: !w, d3, ok3: !w3, M: r.M, r }); return r;
}
function init() { P.setBaseline(P.base, Pol2()); const { BS, BM } = P.baseline(); console.log(`основа panicx-best ${['sel', 'ex', 'rnd'].map((g) => P.f(BS[g].all)).join(' | ')} | паника ${BM.fall.toFixed(1)}%/${BM.days}д/${BM.big.toFixed(0)}% монеты ${BM.fallC.toFixed(1)}%/${BM.daysC.toFixed(0)}д`); }
const summary = (a = rows) => { const ds = a.map((x) => x.d).sort((x, y) => x - y); return `вариантов ${a.length}, ✔ к panicx ${a.filter((x) => x.ok).length}, ✔ к C3 ${a.filter((x) => x.ok3).length}; доход к panicx мин ${ds[0].toFixed(3)} мед ${ds[ds.length >> 1].toFixed(3)} макс ${ds[ds.length - 1].toFixed(3)}`; };
module.exports = { P, Z, G, Pol2, BEST1, run, rows, init, summary, why, c3 };
