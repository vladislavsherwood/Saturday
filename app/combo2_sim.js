/* Объединение 2: находки агентов по сегментам (крупные, мемы, альты, теханализ) поверх combo-best (F + C1.25 + C6).
   Один стенд индикаторов для быстрого оценщика agent_sim.js (через combo_sim.js):
   - списки монет (единые): BIG — 9 крупных (агент «крупные»), MEME — 18 мемов агента «мемы» + KIMCHI (у агента «альты» мем), STABLE — ZCHF;
     ALT — всё остальное. Флаги-индикаторы isbig, meme, isalt (1/0 на всю историю монеты).
   - corr180, vol180, rel180, up90, hi90, ago_qt — уже есть (agent4c_sim / agent4b_cand); b_bbwp, b_w20 — по BTC из ta_sim.js.
   Сборка правил: из «сырой» основы (F + C6, без копий C) — для каждого правила продажи все копии с наборами модификаторов
   (C, CM2, B65 / список|B65, A1, TA), от самого полного набора к пустому, перед исходным правилом; доля = доля × произведение множителей
   (с ограничением «cap»), не больше 100%. AS (альтсезон) — последним правилом.
   Использование: const Z = require('./combo2_sim.js'); const G = Z.load(); const S = Z.build({ cm2: true, b65: 'b', a1: true, as: true }) */
const K = require('./combo_sim.js');
const fs = require('fs');
const { c } = K;
const BIG = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'TRX', 'ADA', 'LTC', 'BCH'];
const MEME = ['DOGE', 'PUMP', 'SHIB', 'PEPE', 'BONK', 'WIF', 'FLOKI', 'FARTCOIN', 'ELON', 'NPC', 'PENGU', 'TIBBIR', 'B', 'APEPE', 'MOG', 'BANANAS31', 'JELLYJELLY', 'NOT', 'KIMCHI'];
const STABLE = ['ZCHF'];
const seg = (nm) => (BIG.includes(nm) ? 'big' : MEME.includes(nm) ? 'meme' : STABLE.includes(nm) ? 'stable' : 'alt');
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE = { base: BEST.base, rules: BEST.rules };
// «сырая» основа: без копий C (правила с rel180 < −15)
const RAW = { base: BEST.base, rules: BEST.rules.filter((r) => !r.conds.some((x) => x.ind === 'rel180')) };
const has = (r, ind) => r.conds.some((x) => x.ind === ind);
// классы правил продажи
function cls(r) {
  if (r.act >= 0) return null;
  if (has(r, 'fng') && r.conds.some((x) => x.ind === 'fng' && x.op === '<' && x.v === 52)) return 'fear';
  if (has(r, 'fund30')) return 'fund';
  if (has(r, 'qt')) return 'qt';
  if (has(r, 'oth90')) return 'wide';
  if (has(r, 'up90')) return 'pump';
  return 'other';
}
const ALL = ['fear', 'fund', 'qt', 'wide', 'pump'];
// модификаторы: id, наборы условий (ИЛИ между наборами), множитель по классу правила, «требует» (CM2 включён только вместе с C)
function mods(o) {
  const M = [];
  if (o.c !== false) M.push({ id: 'C', sets: [[c('rel180', '<', -15)]], k: Object.fromEntries(ALL.map((q) => [q, o.ck || 1.25])) });
  if (o.cm2) M.push({ id: 'CM2', sets: [[c('meme', '>', 0.5)]], k: Object.fromEntries(ALL.map((q) => [q, (o.cm2k || 2) / (o.ck || 1.25)])), req: 'C', ex: ['A1'] });
  if (o.b65) {
    const beh = [c('corr180', '>', o.bc || 0.65), c('vol180', '<', o.bv || 90)];
    if (o.b65nomeme) beh.push(c('meme', '<', 0.5));
    M.push({ id: 'B65', sets: o.b65 === 'list' ? [[c('isbig', '>', 0.5)], beh] : o.b65 === 'listonly' ? [[c('isbig', '>', 0.5)]] : [beh], k: { qt: o.bq || 1.5, wide: o.bq || 1.5, fear: o.bf || 1.25 } });
  }
  if (o.a1) M.push({ id: 'A1', sets: [[c('isalt', '>', 0.5)]], k: { wide: o.a1k || 1.25 }, ex: ['CM2'] });
  if (o.ta) M.push({ id: 'TA', sets: [[c('b_bbwp', '<', o.tab || 0.4), c('b_w20', '<', 1)]], k: { fear: o.tak || 1.25 } });
  return M;
}
// множитель набора модификаторов для класса q; cap — ограничение произведения «не-C» множителей по классу (например, { qt: 1.5, wide: 1.5 })
function kOf(sub, q, o) {
  let kc = 1, kx = 1;
  for (const m of sub) { const k = m.k[q] || 1; if (m.id === 'C' || m.id === 'CM2') kc *= k; else if (o.combine === 'max') kx = Math.max(kx, k); else kx *= k; }
  if (o.cap && o.cap[q]) kx = Math.min(kx, o.cap[q]);
  return kc * kx;
}
function build(o = {}) {
  const M = mods(o), rules = [];
  for (const r of RAW.rules) {
    const q = cls(r);
    if (!q) { rules.push(r); continue; }
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
      const k = kOf(sub, q, o); if (Math.abs(k - 1) < 1e-12) continue;
      const act = Math.max(-1, +(r.act * k).toFixed(6));
      // декартово произведение альтернатив (ИЛИ) модификаторов
      let combos = [[]];
      for (const m of sub) combos = combos.flatMap((cs) => m.sets.map((s) => [...cs, ...s]));
      for (const cs of combos) rules.push({ act, conds: [...r.conds, ...cs] });
    }
    rules.push(r);
  }
  if (o.as) rules.push({ act: -(o.asz || 0.1), conds: [c('isalt', '>', 0.5), c('fng', '>', o.asf || 65), c('oth90', '>', 1)] });
  return { base: RAW.base, rules };
}
// стенд: группы с подготовкой, флаги, индикаторы ТА по BTC
let G0 = null;
function load(list = ['sel', 'ex', 'rnd', 'n100']) {
  if (G0) return G0;
  const G = K.groups(list); K.prep(G);
  const T = require('./ta_sim.js'), B = T.btcTA();
  for (const g in G) for (const X of G[g]) {
    const s = seg(X.name); X.seg = s; X.grp = g;
    const f = (v) => { const a = new Float64Array(X.n); a.fill(v); return a; };
    X.ind.isbig = f(s === 'big' ? 1 : 0); X.ind.meme = f(s === 'meme' ? 1 : 0); X.ind.isalt = f(s === 'alt' ? 1 : 0);
    for (const k of ['b_bbwp', 'b_w20']) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const j = B.map.get(X.t[i]); a[i] = j == null ? NaN : B.o[k][j]; } X.ind[k] = a; }
  }
  return (G0 = G);
}
// оценка по монетам: full, h1, h2 (худший из двух сдвигов)
function evc(G, S, list = Object.keys(G)) { const o = {}; for (const g of list) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: K.E(X, S, 'full'), h1: K.E(X, S, 'h1'), h2: K.E(X, S, 'h2') })); return o; }
const med = K.med;
function st(a) { if (!a.length) return null; const f = a.map((x) => x.f), h = a.flatMap((x) => [x.h1, x.h2]); return { n: f.length, med: med(f), pos: f.filter((v) => v > 0).length, worst: Math.min(...f), hpos: h.filter((v) => v > 0).length, hn: h.length, hworst: Math.min(...h), e: f }; }
const SEGS = ['all', 'big', 'alt', 'meme'];
function sum(r) { const o = {}; for (const g in r) { o[g] = {}; for (const s of SEGS) o[g][s] = st(s === 'all' ? r[g] : r[g].filter((x) => x.seg === s)); } return o; }
const L1 = (m) => Math.log1p(m / 100);
// доход: сумма лог-медиан отбора, экзамена, 50 случайных (для сегмента — по тем группам, где он есть)
const inc = (R, s) => ['sel', 'ex', 'rnd'].reduce((t, g) => t + (R[g][s] ? L1(R[g][s].med) : 0), 0);
// строгая проверка (вся выборка — как K.passes; сегмент — то же внутри сегмента)
function strict(R, B, s) {
  const o = [];
  for (const g of ['sel', 'ex', 'rnd']) {
    const x = R[g][s], y = B[g][s]; if (!x) continue;
    if (x.pos < y.pos) o.push(`${g}:плюс ${x.pos}<${y.pos}`);
    if (x.hpos < y.hpos) o.push(`${g}:пол ${x.hpos}<${y.hpos}`);
    if (x.hworst < y.hworst - 1e-9) o.push(`${g}:хп ${x.hworst.toFixed(1)}<${y.hworst.toFixed(1)}`);
    if (g !== 'rnd' && x.worst < y.worst - 1e-9) o.push(`${g}:худш ${x.worst.toFixed(1)}<${y.worst.toFixed(1)}`);
  }
  return o;
}
// средний лог-прирост по монетам сегмента к основе и лучше/хуже (старые группы | 100 новых)
function mlog(r, b, s, gs) { let t = 0, n = 0, u = 0, d = 0; for (const g of gs) if (r[g]) r[g].forEach((x, i) => { if (s !== 'all' && x.seg !== s) return; const y = b[g][i]; t += L1(x.f) - L1(y.f); n++; if (x.f > y.f + 0.5) u++; else if (x.f < y.f - 0.5) d++; }); return { m: n ? t / n : 0, u, d, n }; }
module.exports = { K, c, BIG, MEME, STABLE, seg, BEST, BASE, RAW, cls, mods, build, load, evc, st, sum, inc, strict, mlog, L1, SEGS, med };
