/* tune3: шлифовка продаж на страхе и фандинге и множителей продаж поверх combo2 (быстрый оценщик combo2_sim.js).
   Параметры (по умолчанию = combo2): sf — сильный страх fng < 40, sfs — доля 30%; f — страх fng < 52 (только в правилах продажи), fs — 16%;
   ud — порог доли USDT в страх-продажах (7,6; uds — отдельно для сильного страха); fu — фандинг fund30 > 2, fus — 5%;
   ck — отстающая ×1,25, cv — rel < −15, cw — окно 180; cm2k — отстающий мем ×2 (ckf / cm2kf — отдельно для продажи по фандингу); bf — крупная на страхе ×1,25; bc/bv — corr180 > 0,65, vol180 < 90.
   Использование: const T = require('./tune3_sim.js'); const G = T.load(); const S = T.build({ fs: 0.17 }) */
const Z = require('./combo2_sim.js'); const { K, c } = Z;
const D = { sf: 40, sfs: 0.3, f: 52, fs: 0.16, ud: 7.6, uds: null, fu: 2, fus: 0.05, ck: 1.25, cv: -15, cw: 180, cm2k: 2, bf: 1.25, bc: 0.65, bv: 90, bq: 1.5, a1k: 1.25 };
const OPT = { a1: true, as: true, cm2: true, b65: 'list' };
// «сырая» основа с классами (класс считается по исходным порогам)
const RAWQ = Z.RAW.rules.map((r) => ({ r, q: Z.cls(r), strong: r.act < 0 && r.conds.some((x) => x.ind === 'fng' && x.op === '<' && x.v === 40) }));
function rawRules(p) {
  return RAWQ.map(({ r, q, strong }) => {
    if (q === 'fear') {
      const conds = r.conds.map((x) => x.ind === 'fng' && x.v === 52 ? c('fng', '<', p.f) : x.ind === 'fng' && x.v === 40 ? c('fng', '<', p.sf) : x.ind === 'usdtd' ? c('usdtd', '<', strong && p.uds != null ? p.uds : p.ud) : x);
      return { q, r: { act: strong ? -p.sfs : -p.fs, conds } };
    }
    if (q === 'fund') return { q, r: { act: -p.fus, conds: [c('fund30', '>', p.fu)] } };
    return { q, r };
  });
}
function mods(p) {
  const ALL = ['fear', 'fund', 'qt', 'wide', 'pump'], rel = 'rel' + p.cw;
  const M = [];
  const ckq = (q) => (q === 'fund' && p.ckf != null ? p.ckf : p.ck), cmq = (q) => (q === 'fund' && p.cm2kf != null ? p.cm2kf : p.cm2k);
  M.push({ id: 'C', sets: [[c(rel, '<', p.cv)]], k: Object.fromEntries(ALL.map((q) => [q, ckq(q)])) });
  M.push({ id: 'CM2', sets: [[c('meme', '>', 0.5)]], k: Object.fromEntries(ALL.map((q) => [q, cmq(q) / ckq(q)])), req: 'C', ex: ['A1'] });
  const beh = [c('corr180', '>', p.bc), c('vol180', '<', p.bv)];
  M.push({ id: 'B65', sets: [[c('isbig', '>', 0.5)], beh], k: { qt: p.bq, wide: p.bq, fear: p.bf } });
  M.push({ id: 'A1', sets: [[c('isalt', '>', 0.5)]], k: { wide: p.a1k }, ex: ['CM2'] });
  return M;
}
function build(o = {}) {
  const p = { ...D, ...o }, M = mods(p), rules = [];
  for (const { r, q } of rawRules(p)) {
    if (!q || q === 'other') { rules.push(r); continue; }
    const app = M.filter((m) => (m.k[q] || 1) !== 1);
    const subs = [];
    for (let mask = 1; mask < 1 << app.length; mask++) {
      const sub = app.filter((_, i) => mask & (1 << i));
      if (sub.some((m) => m.req && !sub.some((x) => x.id === m.req))) continue;
      if (sub.some((m) => m.ex && sub.some((x) => m.ex.includes(x.id)))) continue;
      subs.push(sub);
    }
    subs.sort((a, b) => b.length - a.length);
    for (const sub of subs) {
      let k = 1; for (const m of sub) k *= m.k[q] || 1;
      if (Math.abs(k - 1) < 1e-12) continue;
      const act = Math.max(-1, +(r.act * k).toFixed(6));
      let combos = [[]];
      for (const m of sub) combos = combos.flatMap((cs) => m.sets.map((s) => [...cs, ...s]));
      const SEGF = ['isbig', 'meme', 'isalt'];
      for (const cs of combos) if (new Set(cs.filter((x) => SEGF.includes(x.ind) && x.op === '>').map((x) => x.ind)).size < 2) rules.push({ act, conds: [...r.conds, ...cs] });
    }
    rules.push(r);
  }
  rules.push({ act: -0.1, conds: [c('isalt', '>', 0.5), c('fng', '>', 65), c('oth90', '>', 1)] });
  return { base: Z.RAW.base, rules };
}
const RELW = [90, 120, 150, 165, 180, 195, 210, 240, 270];
function load(list) {
  const G = Z.load(list);
  for (const g in G) for (const X of G[g]) {
    const b = X.ind.btcp, cl = X.c, n = X.n;
    for (const w of RELW) { if (X.ind['rel' + w] && w !== 165 && w !== 195) continue; const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = b && i >= w && b[i] > 0 && b[i - w] > 0 ? ((cl[i] / cl[i - w]) / (b[i] / b[i - w]) - 1) * 100 : NaN; X.ind['rel' + w] = a; }
  }
  return G;
}
// оценка: R по группам/сегментам, доход и строгая к базе (в т. ч. сегменты)
function evalv(G, o, groups = ['sel', 'ex', 'rnd']) { const S = build(o); const r = Z.evc(G, S, groups); return { r, R: Z.sum(r), n: S.rules.length }; }
function cmp(X, B) { const o = {}; for (const s of Z.SEGS) o[s] = { inc: Z.inc(X.R, s) - Z.inc(B.R, s), strict: Z.strict(X.R, B.R, s) }; return o; }
module.exports = { Z, K, D, OPT, build, load, evalv, cmp, rawRules };
