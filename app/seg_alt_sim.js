/* Агент «АЛЬТЫ»: помощники поверх combo_sim.js (быстрый оценщик agent_sim.js + признаки 4C + ago_qt 4B).
   Делит каждую группу (отбор, экзамен, 50 случайных, 100 новых) на альты и остальные (крупные + мемы + стейблы),
   считает статистику по подгруппам, строгую проверку внутри альтов и «не хуже» на остальных.
   Использование: const Q = require('./seg_alt_sim.js'); const G = Q.load(); const r = Q.evs(G, S); Q.cmp(r, rb) */
const K = require('./combo_sim.js');
const fs = require('fs');
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const BASE = { base: BEST.base, rules: BEST.rules };
const LARGE = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'TRX', 'ADA'];
const MEME = ['DOGE', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'PUMP', 'FARTCOIN', 'ELON', 'NPC', 'PENGU', 'TIBBIR', 'MOG', 'APEPE', 'BANANAS31', 'JELLYJELLY', 'KIMCHI'];
const STABLE = ['ZCHF'];
const cls = (nm) => (LARGE.includes(nm) ? 'large' : MEME.includes(nm) ? 'meme' : STABLE.includes(nm) ? 'stable' : 'alt');
const isAlt = (X) => cls(X.name) === 'alt';
const GR = ['sel', 'ex', 'rnd', 'n100'];
function load(list = GR) { const G = K.groups(list); K.prep(G); return G; }
const med = K.med;
// по каждой монете: full/h1/h2 (худший из двух сдвигов)
function coinRes(G, S, list = GR) {
  const o = {};
  for (const g of list) o[g] = G[g].map((X) => ({ name: X.name, alt: isAlt(X), full: K.E(X, S, 'full'), h1: K.E(X, S, 'h1'), h2: K.E(X, S, 'h2') }));
  return o;
}
const st = (a) => { if (!a.length) return null; const f = a.map((x) => x.full), h = a.flatMap((x) => [x.h1, x.h2]); return { n: f.length, med: med(f), pos: f.filter((v) => v > 0).length, worst: Math.min(...f), hpos: h.filter((v) => v > 0).length, hworst: Math.min(...h) }; };
// статистика: all / alt / oth по группам
function evs(G, S, list = GR) {
  const c = coinRes(G, S, list), r = { c };
  for (const g of list) r[g] = { all: st(c[g]), alt: st(c[g].filter((x) => x.alt)), oth: st(c[g].filter((x) => !x.alt)) };
  return r;
}
const L1 = (m) => Math.log1p(m / 100);
const inc = (r, sub) => ['sel', 'ex', 'rnd'].reduce((s, g) => s + L1(r[g][sub].med), 0);
// строгая проверка подгруппы: отбор/экзамен — в плюсе, худшая, половины, худшая половина; 50 случайных — в плюсе, половины, худшая половина
function strict(r, b, sub) {
  const o = [];
  for (const g of ['sel', 'ex', 'rnd']) {
    const x = r[g][sub], y = b[g][sub]; if (!x) continue;
    if (x.pos < y.pos) o.push(`${g} плюс ${x.pos}<${y.pos}`);
    if (x.hpos < y.hpos) o.push(`${g} пол ${x.hpos}<${y.hpos}`);
    if (x.hworst < y.hworst - 1e-9) o.push(`${g} хп ${x.hworst.toFixed(1)}<${y.hworst.toFixed(1)}`);
    if (g !== 'rnd' && x.worst < y.worst - 1e-9) o.push(`${g} худш ${x.worst.toFixed(1)}<${y.worst.toFixed(1)}`);
  }
  return o;
}
// лучше/хуже по монетам подгруппы
const bw = (r, b, g, sub) => { let p = 0, m = 0; r.c[g].forEach((x, i) => { if (sub === 'alt' && !x.alt) return; if (sub === 'oth' && x.alt) return; const y = b.c[g][i].full; if (x.full > y + 0.5) p++; else if (x.full < y - 0.5) m++; }); return [p, m]; };
const f0 = (v) => (v == null ? '—' : v.toFixed(0));
function row(tag, r, b) {
  const part = (sub) => GR.filter((g) => r[g]).map((g) => `${f0(r[g][sub].med)}${b ? '(' + (r[g][sub].med - b[g][sub].med >= 0 ? '+' : '') + (r[g][sub].med - b[g][sub].med).toFixed(0) + ')' : ''}`).join('/');
  let s = `${tag}\n   альты ${part('alt')} | остальные ${part('oth')} | все ${part('all')}`;
  if (b) {
    const sa = strict(r, b, 'alt'), so = strict(r, b, 'oth'), sall = strict(r, b, 'all');
    s += `\n   доход: альты ${(inc(r, 'alt') - inc(b, 'alt')).toFixed(3)}, остальные ${(inc(r, 'oth') - inc(b, 'oth')).toFixed(3)}, все ${(inc(r, 'all') - inc(b, 'all')).toFixed(3)}`;
    s += ` | строгая: альты ${sa.length ? '· ' + sa.join(',') : '✔'}; остальные ${so.length ? '· ' + so.join(',') : '✔'}; все ${sall.length ? '· ' + sall.join(',') : '✔'}`;
    s += `\n   лучше/хуже альты ${GR.filter((g) => r[g]).map((g) => bw(r, b, g, 'alt').join('/')).join(' ')} | остальные ${GR.filter((g) => r[g]).map((g) => bw(r, b, g, 'oth').join('/')).join(' ')}`;
    if (r.n100) s += ` | 100н: альты плюс ${r.n100.alt.pos}/${r.n100.alt.n} пол ${r.n100.alt.hpos}; все плюс ${r.n100.all.pos} пол ${r.n100.all.hpos}`;
  }
  return s;
}
// краткая запись для json
const pack = (r, b) => { const o = {}; for (const g of GR) if (r[g]) o[g] = r[g]; if (b) o.d = { alt: inc(r, 'alt') - inc(b, 'alt'), oth: inc(r, 'oth') - inc(b, 'oth'), all: inc(r, 'all') - inc(b, 'all'), sAlt: strict(r, b, 'alt'), sOth: strict(r, b, 'oth'), sAll: strict(r, b, 'all') }; return o; };
// флаг альта как индикатор монеты (для правил «только для альтов»): isalt = 1 у альтов
function addAltFlag(G) { for (const g in G) for (const X of G[g]) if (!X.ind.isalt) { const a = new Float64Array(X.n); a.fill(isAlt(X) ? 1 : 0); X.ind.isalt = a; } }
module.exports = { K, BASE, BEST, LARGE, MEME, STABLE, cls, isAlt, GR, load, coinRes, evs, st, inc, strict, bw, row, pack, addAltFlag, c: K.c };
