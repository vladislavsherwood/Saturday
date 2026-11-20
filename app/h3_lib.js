/* h3: упущенные вершины. Общие помощники поверх r4_lib.js (основа — combo4 из found/combo4-best.json, 57 правил, + «ловушка для фитилей»).
   Использование: const H = require('./h3_lib.js'); H.base('wick' | 'c4'); H.run('имя', S, pol, { n100: true }) */
const L = require('./r4_lib.js'), { P, G, c } = L;
const S57 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polW = { ...L.pol0, wick: WICK };
const polC = L.pol0;
const cl = (S = S57) => ({ ...S, rules: S.rules.map((r) => JSON.parse(JSON.stringify(r))) });
let cur = null;
function base(k = 'wick') { cur = k; if (k === 'wick') P.setBaseline(S57, polW); else P.setBaseline(S57, polC); return k === 'wick' ? polW : polC; }
// pol с дополнительным полем (h3_…): копия основы
const withPol = (k, extra = {}) => ({ ...(k === 'wick' ? polW : polC), ...extra });
const day = L.day;
module.exports = { L, P, G, c, S57, WICK, polW, polC, cl, base, withPol, day, run: L.run };
// вставить правило: pos = 'end' | 'pre27' (перед разворотом BTC) | 'first' | число (индекс в правилах combo4)
function ins(S, rules, pos = 'end') { const T = cl(S), rs = Array.isArray(rules) ? rules : [rules]; const k = pos === 'end' ? T.rules.length : pos === 'pre27' ? T.rules.indexOf(T.rules[26]) : pos === 'first' ? 0 : pos; T.rules.splice(k, 0, ...rs.map((r) => JSON.parse(JSON.stringify(r)))); return T; }
// признаки монеты h3: остаток с поправкой на бету (лог-рост монеты за w дн − бета180 × лог-рост BTC), пара монета/BTC
let indDone = false;
function inds() {
  if (indDone) return; indDone = true;
  L.addInd('res90', (X) => { const n = X.n, a = new Float64Array(n).fill(NaN), c = X.c, b = X.ind.btcp, be = X.ind.beta180; for (let i = 90; i < n; i++) if (c[i - 90] > 0 && b[i - 90] > 0 && isFinite(be[i])) a[i] = Math.log(c[i] / c[i - 90]) - be[i] * Math.log(b[i] / b[i - 90]); return a; });
  L.addInd('res30', (X) => { const n = X.n, a = new Float64Array(n).fill(NaN), c = X.c, b = X.ind.btcp, be = X.ind.beta180; for (let i = 30; i < n; i++) if (c[i - 30] > 0 && b[i - 30] > 0 && isFinite(be[i])) a[i] = Math.log(c[i] / c[i - 30]) - be[i] * Math.log(b[i] / b[i - 30]); return a; });
}
// продажи нового правила (по ссылке на объект правила): сколько эпизодов, где проданное потом ушло на +200% (макс. за 365 дн ≥ 3 × цены продажи) — «провалы»
function fails(S, rule, pol, lists = ['sel', 'ex', 'rnd', 'n100']) {
  let ep = 0, bad = 0, badSh = 0; const ex = [];
  for (const g of lists) for (const X of G[g]) {
    const Rc = S.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind]));
    const pp = { ...pol, trace: [] };
    const { tr } = P.edge(X, S, 0, 'full', true, pp); let last = -1e9, cur = null;
    for (const t of tr) { if (!(t.s < 0 && Rc[t.q] === rule)) continue;
      const U = pp.trace[t.i - 1] ? pp.trace[t.i - 1][2] * X.c[t.i] : 1;
      if (t.i - last > 30) { cur = { g, nm: X.name, i: t.i, d: L.day(X.ind.t[t.i]), sh: 0, p: t.p }; ep++; (cur.list = ex).push(cur); }
      cur.sh = 1 - (1 - cur.sh) * (1 - t.amt / Math.max(U, 1e-9)); last = t.i; }
  }
  for (const e of ex) { const X = G[e.g].find((x) => x.name === e.nm); let m = 0; for (let k = e.i; k < Math.min(X.n, e.i + 365); k++) m = Math.max(m, X.c[k]); e.fwd = m / e.p; if (e.fwd >= 3 && e.sh >= 0.1) { bad++; badSh += e.sh; } }
  return { ep, bad, ex };
}
Object.assign(module.exports, { ins, inds, fails });
// по монетам: изменение итога (лог) к основе — худшие и лучшие; r — результат L.run
function diffCoins(r, k = 6) {
  const { BR } = P.baseline(), a = [];
  for (const g of ['sel', 'ex', 'rnd']) r.R[g].forEach((x, i) => { const y = BR[g][i]; a.push({ g, nm: x.name, seg: x.seg, d: Math.log1p(x.f / 100) - Math.log1p(y.f / 100), f: x.f, f0: y.f, h1: x.h1, h10: y.h1, h2: x.h2, h20: y.h2 }); });
  a.sort((x, y) => x.d - y.d);
  const s = (x) => `${x.nm}(${x.g}) ${x.f0.toFixed(0)}→${x.f.toFixed(0)} [${x.h10.toFixed(0)}/${x.h20.toFixed(0)}→${x.h1.toFixed(0)}/${x.h2.toFixed(0)}]`;
  return `хуже: ${a.slice(0, k).filter((x) => x.d < -0.005).map(s).join('; ')} || лучше: ${a.slice(-k).reverse().filter((x) => x.d > 0.005).map(s).join('; ')} || средний лог 81: ${(a.reduce((t, x) => t + x.d, 0) / a.length).toFixed(4)} (${a.filter((x) => x.d > 0.005).length}/${a.filter((x) => x.d < -0.005).length})`;
}
Object.assign(module.exports, { diffCoins });
