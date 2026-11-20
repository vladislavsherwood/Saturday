/* h4: общие помощники — провальные годы (2019, 2023, 2026) поверх combo4 (57 правил) + «ловушка для фитилей».
   S57 — правила found/combo4-best.json; polW — pol0 (Boost(2, { k: 0, A: 0 })) + фитили (found/wick-best.json).
   run(имя, S, pol, { n100, base }) — строка r4_lib.run + изменение по годам к основе: медиана по 81 монете разности годового прироста ln(капитал/DCA)
   и «действий года» (ln(V/B1), B1 — состояние на начало года без сделок + взносы как DCA; см. h4_dec.js), сдвиг исполнения 0.
   Политики: gatePol(opt) — обёртка над Boost(2, { k: 0, A: 0 }) с воротами и бюджетом эпизода паники (см. ниже). */
const L = require('./r4_lib.js'), { P, P2, G, c } = L;
const S57 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polW = { ...L.pol0, wick: WICK };
const YS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const mean = (v) => { const a = v.filter(isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
// годовые приросты по монетам: { name: { y: { tot, act } } }
function years(S, pol, lists = ['sel', 'ex', 'rnd']) {
  const o = {};
  for (const g of lists) for (const X of G[g]) {
    const pl = { ...pol, trace: [] }; P.edge(X, S, 0, 'full', false, pl); const T = pl.trace, cc = X.c, n = X.n, I = X.ind;
    let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (10 * 0.999) / cc[i]; D[i] = du * cc[i]; }
    const V = T.map(([i, cash, u]) => cash + u * cc[i]); const yOf = (i) => +L.day(I.t[i]).slice(0, 4); const r = (o[X.name] = {});
    let a = 0;
    while (a < n) {
      const y = yOf(a); let b = a; while (b + 1 < n && yOf(b + 1) === y) b++;
      if (a > 0 && b > 120) { let dy = 0; for (let i = a; i <= b; i++) dy += (10 * 0.999) / cc[i]; const B1 = T[a - 1][1] + (T[a - 1][2] + dy) * cc[b];
        r[y] = { tot: Math.log(V[b] / D[b]) - Math.log(V[a - 1] / D[a - 1]), act: Math.log(V[b] / B1) }; }
      a = b + 1;
    }
  }
  return o;
}
let YB = null, YB100 = null;
function setBase(S, pol) { P.setBaseline(S, pol); YB = years(S, pol); YB100 = null; }
const sg = (x, d = 2) => (x >= 0 ? '+' : '') + x.toFixed(d);
function ydiff(Y, Yb = YB) {
  const out = {};
  for (const y of YS) { const d = [], da = []; for (const nm in Y) if (Y[nm][y] && Yb[nm] && Yb[nm][y]) { d.push(Y[nm][y].tot - Yb[nm][y].tot); da.push(Y[nm][y].act - Yb[nm][y].act); }
    out[y] = { med: med(d), mean: mean(d), up: d.filter((x) => x > 0.005).length, dn: d.filter((x) => x < -0.005).length, n: d.length }; }
  return out;
}
const ystr = (D) => YS.map((y) => `${String(y).slice(2)}:${sg(D[y].mean)}`).join(' ');
const rows = [];
function run(nm, S, pol, { n100 = false, quiet = false, yr = true } = {}) {
  const r = L.run(nm, S, pol, { n100, quiet: true });
  const { BR } = P.baseline(); r.m81 = L.Z.mlog(r.R, BR, 'all', ['sel', 'ex', 'rnd']);
  if (yr) { r.Y = years(S, pol); r.yd = ydiff(r.Y); }
  r.line = r.txt + `\n${''.padEnd(10)}81: ср. лог ${sg(r.m81.m, 3)} ${r.m81.u}/${r.m81.d}` + (yr ? ` | по годам (среднее изменения прироста ln(V/DCA) к основе): ${ystr(r.yd)}` : '');
  if (!quiet) console.log(r.line);
  rows.push({ nm, r }); return r;
}
// --- правила-копии: вставить перед каждым правилом из idx (номера 1…57) копию с доп. условиями и долей f(act)
function withCopies(S, idx, extra, fact) {
  const T = L.clone(S); const out = [];
  T.rules.forEach((r, k) => { if (idx.includes(k + 1)) { const a = fact(r.act); if (a !== null) out.push({ act: a, conds: [...r.conds.map((x) => ({ ...x })), ...extra.map((x) => ({ ...x }))] }); } out.push(r); });
  T.rules = out; return T;
}
// вставить правило(а) перед правилом номер pos (1…57; pos > длины — в конец)
function insertAt(S, pos, rules) { const T = L.clone(S); T.rules.splice(pos - 1, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return T; }
/* gatePol(opt): Boost(2, { k: 0, A: 0 }) +
     gate(I, j) → true: «ворота закрыты» для паники этого дня: buy → 0 (вся доля в долг), release → 0 (долг ждёт; если ворота закрыты и в конце эпизода — сгорает,
       pendRel: 1 — в конце эпизода тратится, как в основе), extra → 0;
     budget B: в эпизоде траты паники (st.spent) не больше B × (резерв на старте эпизода + взносы эпизода) — сверх бюджета то же, что закрытые ворота;
     relMult(I, j) → множитель надбавки на развороте (по умолчанию 2). wick — фитили (по умолчанию да). */
function gatePol(opt = {}) {
  const b = P2.Pol2({ k: 0, A: 0 }), m0 = opt.m || 2;
  const closed = (X, j, st) => (opt.gate && opt.gate(X.ind, j, X)) || (opt.B != null && st.spent > opt.B * (st.r0 + 10 * Math.max(0, j - st.ep)));
  const pol = {
    buy: (ctx) => (closed(ctx.X, ctx.j, ctx.st) ? 0 : b.buy(ctx)),
    release: (ctx) => { if (closed(ctx.X, ctx.j, ctx.st) && !(opt.pendRel && ctx.X.ind.pend[ctx.j])) return 0; const k = b.release(ctx); if (k > 0 && !ctx.X.ind.pend[ctx.j]) { ctx.st.rl = k * ctx.st.owed; ctx.st.mm = opt.relMult ? opt.relMult(ctx.X.ind, ctx.j, ctx.X) : m0; } return k; },
    extra: ({ before, st }) => { if (!st.rl) return 0; const e = ((st.mm - 1) * st.rl) / Math.max(before, 1e-9); st.rl = 0; return e; },
  };
  if (opt.wick !== false) pol.wick = WICK;
  return pol;
}
module.exports = { L, P, P2, G, c, S57, WICK, polW, YS, years, setBase, ydiff, ystr, run, rows, withCopies, insertAt, gatePol, med, mean, sg };
