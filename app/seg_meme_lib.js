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
