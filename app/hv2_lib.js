/* hv2: риски кандидата hv и подход лучше. Помощники поверх hv_lib.js и крючков panicx_sim.js pol.hv_sell / pol.hv_after.
   Вариант o = {
     gf(h) → 0…1 — вес режима по волатильности дня (плавный: ramp(a, b); ступени; двоичный h > T),
     M — множитель доли при весе 1 (m = 1 + (M − 1) · вес), Mw / Mp / Me — отдельно для широкой вершины / пампа / эйфории,
     U — порог пампа при весе 1 (300 → U; порог U(вес) = 300 − (300 − U) · вес, через индикатор hvup = up90 + (300 − U) · вес и копии правил 53–55),
     ex(X, j) → true — монета-исключение в этот день (по умолчанию список крупных isbig), ep(t) → true — эпоха, где правила включены (по умолчанию все),
     mode: 'now' (вся добавка сразу) | 'same' (добавка только в день слабости) | 'defer' (добавка ждёт первой слабости ≤ W дн) | 'half' (половина сразу, половина на слабости),
     N, k — слабость: закрытие ниже максимума закрытий за N дней на k% и больше; W — срок ожидания отложенной добавки }.
   Семьи (индексы в списке 58, с 0): широкая тихая вершина 39–50, памп в медвежьем рынке 52–54, эйфория 56–57. */
const H = require('./hv_lib.js'), { L, P, G, c, L1, BY } = H;
const FAM = (k) => (k >= 39 && k <= 50 ? 'w' : k >= 52 && k <= 54 ? 'p' : k === 56 || k === 57 ? 'e' : null);
const clamp = (x) => Math.max(0, Math.min(1, x));
const ramp = (a, b) => (h) => clamp((h - a) / (b - a));
const step = (T) => (h) => (h > T ? 1 : 0);
const steps = (pairs) => (h) => { let g = 0; for (const [t, w] of pairs) if (h > t) g = w; return g; }; // [[порог, вес], …] по возрастанию
const EXL = { list: (X, j) => X.ind.isbig[j] > 0.5, none: () => false };
// слабость: закрытие ниже максимума закрытий за N дней (включая день j) на k% и больше
for (const N of [3, 5, 7, 10]) L.addInd('wdd' + N, (X) => { const a = new Float64Array(X.n); for (let j = 0; j < X.n; j++) { let m = 0; for (let q = Math.max(0, j - N + 1); q <= j; q++) m = Math.max(m, X.c[q]); a[j] = (1 - X.c[j] / m) * 100; } return a; });
const weakF = (o) => (X, j) => X.ind['wdd' + (o.N || 7)][j] >= (o.k || 10);
const HV_DEF = { gf: step(120), M: 2, U: 200, mode: 'now', N: 7, k: 10, W: 30 };
// сборка варианта: { S, pol, prep, o }; prep() — пересчитать индикатор hvup под этот вариант (перед каждой оценкой)
function make(o0 = {}) {
  const o = { ...HV_DEF, ...o0 }, ex = o.ex || EXL.list, ep = o.ep || null, weak = weakF(o);
  const Mf = { w: o.Mw ?? o.M, p: o.Mp ?? o.M, e: o.Me ?? o.M };
  const gw = (X, j) => { if (j < 0) return 0; const h = X.ind.hvv[j]; if (!(h > 0) || ex(X, j) || (ep && !ep(X.ind.t[j]))) return 0; return o.gf(h); };
  const prep = () => L.addInd('hvup', (X) => { const a = new Float64Array(X.n); for (let j = 0; j < X.n; j++) { const g = gw(X, j), ok = o.mode === 'now' || weak(X, j); a[j] = X.ind.up90[j] + (g > 0 && ok ? (300 - o.U) * g : 0); } return a; });
  const S = L.clone(H.S5);
  S.rules = H.S5.rules.flatMap((r0, k) => { const r = { ...JSON.parse(JSON.stringify(r0)), hvf: FAM(k) || undefined }; if (FAM(k) !== 'p' || o.U >= 300) return [r];
    const cp = JSON.parse(JSON.stringify(r)); cp.hvc = 1; for (const x of cp.conds) if (x.ind === 'up90') x.ind = 'hvup'; return [cp, r]; });
  const log = (X, i, usd, p) => { if (o.log && usd > 1e-9) o.log.push([X, i, usd, p]); };
  const hv_sell = ({ X, i, j, a, r, p, units, s }) => {
    if (!r.hvf) return a;
    const g = gw(X, j); if (!(g > 0)) return a;
    const m = 1 + (Mf[r.hvf] - 1) * g, full = Math.max(a * m, -1), base = r.hvc && !(X.ind.up90[j] > 300) ? 0 : a; // base — сколько продал бы combo5
    const extra = base - full; // доля позиции сверх combo5 (> 0)
    if (o.mode === 'now' || o.mode === 'same' && weak(X, j) || base === 0) { log(X, i, extra * units * p, p); return o.mode === 'same' && !weak(X, j) && base !== 0 ? base : full; }
    if (o.mode === 'same') return base;
    if (weak(X, j)) { log(X, i, extra * units * p, p); return full; } // уже слабость — добавка сразу
    const now = o.mode === 'half' ? extra / 2 : 0; log(X, i, now * units * p, p);
    s.owe = (s.owe || 0) + (extra - now) * units; s.until = i + o.W; return base - now;
  };
  const hv_after = o.mode === 'defer' || o.mode === 'half' ? ({ X, i, j, p, units, s }) => {
    if (!(s.owe > 0)) return 0; if (i > s.until) { s.owe = 0; return 0; }
    if (!weak(X, j)) return 0; const f = Math.min(1, s.owe / Math.max(units, 1e-12)); log(X, i, f * units * p, p); s.owe = 0; return f;
  } : null;
  const pol = { ...H.polW, hv_sell, ...(hv_after ? { hv_after } : {}) };
  return { S, pol, prep, o };
}
// оценка (hv_lib.ev) с подготовкой индикатора; PUMP — итог к DCA
function run(nm, o = {}, opt = {}) { const V = make(o); V.prep(); const r = H.ev(nm, V.S, V.pol, { ...opt, quiet: true }); r.V = V; r.pump = H.E(BY.PUMP, V.S, V.pol); r.txt += ` | PUMP ${r.pump.toFixed(0)}`; if (!opt.quiet) console.log(r.txt); return r; }
// провалы добавочных продаж: продано сверх combo5, затем монета ×3 и выше за 365 дн (сдвиг 0, отбор + экзамен + 50 случ. + 100 новых)
function fails(V, lists = ['sel', 'ex', 'rnd', 'n100']) {
  V.prep(); V.o.log = []; for (const g of lists) for (const X of G[g]) P.edge(X, V.S, 0, 'full', false, V.pol);
  const lg = V.o.log; V.o.log = null; let n = 0, bad = 0, usd = 0, badUsd = 0;
  for (const [X, i, u, p] of lg) { n++; usd += u; let mx = 0; for (let q = i + 1; q < Math.min(X.n, i + 366); q++) mx = Math.max(mx, X.c[q]); if (mx >= 3 * p) { bad++; badUsd += u; } }
  return { n, bad, pc: (100 * bad) / Math.max(n, 1), pcUsd: (100 * badUsd) / Math.max(usd, 1e-9), usd };
}
const ftxt = (f) => `добавочных продаж ${f.n}, провалов ${f.bad} (${f.pc.toFixed(1)}% по числу, ${f.pcUsd.toFixed(1)}% по деньгам)`;
// эпохи (по дню решения): бык 2017, медведь 2018, подъём 2019–21, медведь 2022, подъём 2023–25, медведь 2025–26
const EP = [['бык ≤2017', -1e9, L.T('2017-12-18')], ['медведь 2018', L.T('2017-12-18'), L.T('2018-12-16')], ['подъём 2019–21', L.T('2018-12-16'), L.T('2021-11-11')],
  ['медведь 2022', L.T('2021-11-11'), L.T('2022-11-22')], ['подъём 2023–25', L.T('2022-11-22'), L.T('2025-10-07')], ['медведь 2025–26', L.T('2025-10-07'), 1e9]];
const inEp = (k) => (t) => t >= EP[k][1] && t < EP[k][2], outEp = (k) => (t) => !(t >= EP[k][1] && t < EP[k][2]);
function epochs(nm, o, { quiet = false } = {}) {
  const out = [];
  for (let k = 0; k < EP.length; k++) {
    const a = run(`${nm} только ${EP[k][0]}`, { ...o, ep: inEp(k) }, { quiet: true }), b = run(`${nm} без ${EP[k][0]}`, { ...o, ep: outEp(k) }, { quiet: true });
    out.push({ ep: EP[k][0], only: a, wo: b });
    if (!quiet) console.log(`  ${EP[k][0].padEnd(16)} только: доход ${H.sg(a.all)} ${a.ok ? '✔' : '✗'} БД ${H.sg(a.hvInc)} БД81 ${H.sg(a.hv81.m, 4)} (${a.hv81.u}/${a.hv81.d}) БД100н ${H.sg(a.nhv.m, 4)} (${a.nhv.u}/${a.nhv.d}) 81 ${H.sg(a.m81.m, 4)} 100н ${H.sg(a.n.m, 4)}` +
      ` | без: доход ${H.sg(b.all)} ${b.ok ? '✔' : '✗'} БД81 ${H.sg(b.hv81.m, 4)} БД100н ${H.sg(b.nhv.m, 4)}`);
  }
  return out;
}
module.exports = { H, L, P, G, c, L1, BY, FAM, ramp, step, steps, EXL, make, run, fails, ftxt, EP, inEp, outEp, epochs, HV_DEF };
