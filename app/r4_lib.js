/* r4: 10 кругов улучшения combo4. Общие помощники.
   combo4 = P.base (55 правил combo3 без tune1) + «эйфория в стейблах» (последним правилом) + политика Boost(2, { k: 0, A: 0 }) (отложенная паника для всех монет).
   Основа сравнения выставляется сразу: P.setBaseline(S0, pol0). Решение — по вчерашнему дню, худший из сдвигов 0/1 (P.E).
   Использование: const L = require('./r4_lib.js'); L.run('имя', S, pol, { n100: true }) */
const P2 = require('./panicx_p2.js'), P = P2.P, Z = P.Z;
const G = P.load();
const c = (ind, op, v) => ({ ind, op, v });
const EUPH = () => ({ act: -0.05, conds: [c('usdt', '<', 0.9), c('age', '>', 540), c('meme', '<', 0.5), c('beta180', '>', 0.9)] });
const pol0 = P2.Boost(2, { k: 0, A: 0 });
const S0 = P.clone(P.base); S0.rules.push(EUPH());
P.setBaseline(S0, pol0);
const clone = (S = S0) => P.clone(S);
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
// строка отчёта: медианы / в плюсе / половин / худшая половина; доход к combo4 (всё, крупные, альты, мемы); строгая; (100 новых)
function run(nm, S = S0, pol = pol0, { n100 = false, quiet = false } = {}) {
  const r = P.report(nm, S, pol, { quiet: true, n100 }), { BS } = P.baseline(), w = why(r);
  const d = (s) => Z.inc(r.RS, s) - Z.inc(BS, s);
  let n = '';
  if (n100) { const { s1, m } = r.N; const q = ['big', 'alt', 'meme'].map((s) => { const b = P.evc; return ''; }); n = ` | 100н ${P.f(s1.n100.all)} лог ${sg(m.m)} ${m.u}/${m.d}`; r.n100 = { med: s1.n100.all.med, pos: s1.n100.all.pos, hpos: s1.n100.all.hpos, m: m.m, u: m.u, d: m.d }; }
  r.w = w; r.dseg = { all: d('all'), big: d('big'), alt: d('alt'), meme: d('meme') };
  r.txt = `${nm.padEnd(44)} ${['sel', 'ex', 'rnd'].map((g) => P.f(r.RS[g].all)).join(' | ')} | ${sg(r.dseg.all)} к ${sg(r.dseg.big)} а ${sg(r.dseg.alt)} м ${sg(r.dseg.meme)} ${w ? '✗' : '✔'}${n}${w ? ' | ' + w.slice(0, 220) : ''}`;
  if (!quiet) console.log(r.txt);
  return r;
}
// сдвиг порогов одного индикатора: f(v) → новый порог (для проверки хрупкости)
function shift(S, ind, f) { const T = clone(S); for (const r of T.rules) for (const cd of r.conds) if (cd.ind === ind) cd.v = f(cd.v); return T; }
// доход (Σ лог-медиан) произвольной стратегии без строгой — быстро
const income = (S, pol = pol0) => Z.inc(Z.sum(P.evc(S, pol)), 'all');
// оценка с произвольным набором сдвигов исполнения (худший из lags)
function evLag(S, pol, lags, lists = ['sel', 'ex', 'rnd']) { const o = {}; const e = (X, part) => Math.min(...lags.map((l) => P.edge(X, S, l, part, false, pol).e)); for (const g of lists) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: e(X, 'full'), h1: e(X, 'h1'), h2: e(X, 'h2') })); return o; }
// добавить индикатор всем монетам: fn(X) → Float64Array
function addInd(name, fn) { for (const g in G) for (const X of G[g]) X.ind[name] = fn(X); }
const day = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
module.exports = { P2, P, Z, G, c, EUPH, pol0, S0, clone, why, sg, run, shift, income, evLag, addInd, day };
// пересчёт эпизодов паники по своему условию on(I, i) (копия panicx_sim.episodes; GAP 10). restoreEp() — вернуть штатные (usdt > 1,07 и othd < 25).
function episodesBy(on) {
  for (const g in G) for (const X of G[g]) {
    const n = X.n, I = X.ind;
    if (!I._ep0) I._ep0 = { pday: I.pday, pend: I.pend, epn: I.epn };
    const pday = new Float64Array(n), pend = new Float64Array(n), epn = new Float64Array(n);
    let st = -1, last = -1e9, cnt = 0;
    for (let i = 0; i < n; i++) {
      const o = on(I, i);
      if (o) { if (i - last > 10) { st = i; cnt++; } last = i; }
      if (st >= 0 && i - last <= 10) { pday[i] = o ? i - st + 1 : 0; pend[i] = !o && i - last === 10 ? 1 : 0; }
      epn[i] = Math.max(0, cnt - 1);
    }
    I.pday = pday; I.pend = pend; I.epn = epn;
  }
}
function restoreEp() { for (const g in G) for (const X of G[g]) if (X.ind._ep0) Object.assign(X.ind, X.ind._ep0); }
const T = (s) => Math.round(Date.parse(s) / 864e5);
const isPanic = P.isP;
Object.assign(module.exports, { episodesBy, restoreEp, T, isPanic });
