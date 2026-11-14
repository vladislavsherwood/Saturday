/* Агент «МЕМЫ»: помощники поверх combo_sim.js (быстрый оценщик agent_sim.js). Основа — found/combo-best.json (F + C1.25 + C6).
   Список мемов по группам (круг 0), оценка «вся выборка / мемы / не мемы» и строгая проверка внутри мемов.
   Использование: const M = require('./seg_meme_lib.js'); const G = M.load(); const r = M.evs(G, S); M.cmp(r, rb) */
const K = require('./combo_sim.js');
const fs = require('fs');
const BASE = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const S0 = { base: BASE.base, rules: BASE.rules };
// мемы (по названию и сути проекта): строгий список и пограничные (NFT-сообщества, BRC-20, «L1 для мемов»)
const MEMES = { sel: ['DOGE', 'PUMP'], ex: ['SHIB', 'PEPE', 'BONK', 'WIF', 'FLOKI', 'FARTCOIN'], rnd: ['ELON', 'NPC', 'PENGU', 'TIBBIR'], n100: ['B', 'APEPE', 'MOG', 'BANANAS31', 'JELLYJELLY', 'NOT'] };
const BORDER = { rnd: ['APE', 'ORDI'], n100: ['M'] };
const isMeme = (X, g) => (MEMES[g] || []).includes(X.name);
let G0 = null;
function load(list = ['sel', 'ex', 'rnd', 'n100']) { if (G0) return G0; const G = K.groups(list); K.prep(G); for (const g in G) G[g].forEach((X) => { X.meme = isMeme(X, g); X.grp = g; }); return (G0 = G); }
// оценка без метрик дна (дешевле); по каждой монете: full, h1, h2
function evc(X, S) { return { f: K.E(X, S, 'full'), h1: K.E(X, S, 'h1'), h2: K.E(X, S, 'h2') }; }
function evs(G, S, groups = Object.keys(G)) { const o = {}; for (const g of groups) o[g] = G[g].map((X) => ({ name: X.name, meme: X.meme, ...evc(X, S) })); return o; }
const med = K.med;
function st(arr) { const f = arr.map((x) => x.f), h = arr.flatMap((x) => [x.h1, x.h2]); return { n: f.length, med: med(f), pos: f.filter((v) => v > 0).length, worst: Math.min(...f), hpos: h.filter((v) => v > 0).length, hworst: Math.min(...h), lm: med(f.map((v) => Math.log1p(v / 100))) }; }
// сводка: по группе g — все / мемы / не мемы
function sum(r) { const o = {}; for (const g in r) o[g] = { all: st(r[g]), meme: st(r[g].filter((x) => x.meme)), non: st(r[g].filter((x) => !x.meme)) }; return o; }
const ok = (a, b) => a.pos >= b.pos && a.hpos >= b.hpos && a.hworst >= b.hworst - 1e-9 && a.worst >= b.worst - 1e-9;
// сравнение с основой: строгая (отбор, экзамен полностью; 50 случ. без худшей монеты — как в общих правилах), доход = сумма лог-медиан sel/ex/rnd; то же внутри мемов
function cmp(r, b, groups = ['sel', 'ex', 'rnd']) {
  const R = sum(r), B = sum(b), out = { all: {}, meme: {}, non: {} };
  for (const k of ['all', 'meme', 'non']) {
    let inc = 0, pass = true; const why = [];
    for (const g of groups) { const a = R[g][k], q = B[g][k]; inc += Math.log1p(a.med / 100) - Math.log1p(q.med / 100);
      const good = g === 'rnd' && k === 'all' ? a.pos >= q.pos && a.hpos >= q.hpos && a.hworst >= q.hworst - 1e-9 : ok(a, q); if (!good) { pass = false; why.push(g); } }
    out[k] = { inc, pass, why: why.join(',') };
  }
  return { R, B, out };
}
const f0 = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
function line(tag, r, b, groups = ['sel', 'ex', 'rnd', 'n100']) {
  const C = cmp(r, b), R = C.R, s = [];
  for (const k of ['all', 'meme', 'non']) s.push(`${k === 'all' ? 'все' : k === 'meme' ? 'мемы' : 'не мемы'} ${C.out[k].inc >= 0 ? '+' : ''}${C.out[k].inc.toFixed(3)}${C.out[k].pass ? '✔' : '·' + C.out[k].why} [` + groups.filter((g) => R[g]).map((g) => `${R[g][k].med.toFixed(0)}/${R[g][k].pos}/${R[g][k].hpos}/${R[g][k].hworst.toFixed(0)}`).join(' ') + ']');
  return `${tag}\n   ${s.join('\n   ')}`;
}
// по монетам: сколько лучше/хуже основы (>0,5 п.п.)
function bw(r, b, g, filt = () => true) { let u = 0, d = 0; r[g].forEach((x, i) => { if (!filt(x)) return; if (x.f > b[g][i].f + 0.5) u++; else if (x.f < b[g][i].f - 0.5) d++; }); return [u, d]; }
const day = (X, i) => new Date(X.t[i] * 864e5).toISOString().slice(0, 10);
module.exports = { K, S0, BASE, MEMES, BORDER, isMeme, load, evc, evs, st, sum, cmp, line, bw, day, med, c: K.c };
// флаги: meme (по списку) — индикатор 1/0 на всех монетах; поведенческий — условие beta180 > v
function flags(G) { for (const g in G) for (const X of G[g]) if (!X.ind.meme) { const a = new Float64Array(X.n); a.fill(X.meme ? 1 : 0); X.ind.meme = a; } }
const FL = { all: [], meme: [K.c('meme', '>', 0.5)], b13: [K.c('beta180', '>', 1.3)], b15: [K.c('beta180', '>', 1.5)] };
// копия правил, выбранных sel(r, i), с добавленными условиями cond и новым act — перед исходным
const pre = (S, sel, cond, act) => ({ ...S, rules: S.rules.flatMap((r, i) => (sel(r, i) ? [{ act: typeof act === 'function' ? act(r) : act, conds: [...r.conds, ...cond] }, r] : [r])) });
const isWide = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'oth90');
const isNarrow = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'qt');
const isRet = (r) => r.conds.some((x) => x.ind === 'ago_qt');
const isPanic = (r) => r.act > 1 && r.conds.some((x) => x.ind === 'usdt') && !r.conds.some((x) => x.ind === 'btcr30');
const isPump = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'up90');
module.exports = { ...module.exports, flags, FL, pre, isWide, isNarrow, isRet, isPanic, isPump };
// по мемам: итог основы → варианта (полная история и половины)
function diffMemes(r, b, filt = (x) => x.meme) { const o = []; for (const g in r) r[g].forEach((x, i) => { if (!filt(x)) return; const q = b[g][i]; if (Math.abs(x.f - q.f) > 0.5 || Math.abs(x.h1 - q.h1) > 0.5 || Math.abs(x.h2 - q.h2) > 0.5) o.push(`${x.name} ${q.f.toFixed(0)}→${x.f.toFixed(0)} (${q.h1.toFixed(0)}→${x.h1.toFixed(0)}/${q.h2.toFixed(0)}→${x.h2.toFixed(0)})`); }); return o.join(', '); }
module.exports.diffMemes = diffMemes;
// устойчивая мера для малых групп: средний лог-прирост по монетам-мемам (полная история) и число лучше/хуже, отдельно для старых групп и 100 новых
function robust(r, b, filt = (x) => x.meme) { const o = {}; for (const [k, gs] of [['old', ['sel', 'ex', 'rnd']], ['n100', ['n100']]]) { let s = 0, n = 0, u = 0, d = 0, hu = 0, hd = 0;
  for (const g of gs) if (r[g]) r[g].forEach((x, i) => { if (!filt(x)) return; const q = b[g][i]; s += Math.log1p(x.f / 100) - Math.log1p(q.f / 100); n++; if (x.f > q.f + 0.5) u++; else if (x.f < q.f - 0.5) d++;
    for (const h of ['h1', 'h2']) { if (x[h] > q[h] + 0.5) hu++; else if (x[h] < q[h] - 0.5) hd++; } });
  o[k] = { mlog: s / n, u, d, hu, hd }; } return o; }
const rs = (o) => `сред.лог мемов старые ${o.old.mlog >= 0 ? '+' : ''}${o.old.mlog.toFixed(3)} (лучше/хуже ${o.old.u}/${o.old.d}, половин ${o.old.hu}/${o.old.hd}) | 100н ${o.n100.mlog >= 0 ? '+' : ''}${o.n100.mlog.toFixed(3)} (${o.n100.u}/${o.n100.d}, пол. ${o.n100.hu}/${o.n100.hd})`;
module.exports.robust = robust; module.exports.rs = rs;
// кандидат: P (мемы: паника только взносом, пока ddm90 < X) + CM (слабый мем, rel180 < −15: все продажи ×k вместо ×1,25). Копии P помечены grp 0 (взнос) для стенда маржи.
const isC = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'rel180');
function cand(X = 35, k = 2, S = S0) {
  let o = X ? pre(S, isPanic, [K.c('meme', '>', 0.5), K.c('ddm90', '<', X)], 1) : S;
  o = { ...o, rules: o.rules.map((r) => (r.act === 1 && r.conds.some((q) => q.ind === 'ddm90') ? { ...r, grp: 0 } : r)) };
  if (k && k !== 1.25) o = pre(o, isC, [K.c('meme', '>', 0.5)], (r) => Math.max(-1, +(r.act * k / 1.25).toFixed(6)));
  return o;
}
module.exports.cand = cand; module.exports.isC = isC;
