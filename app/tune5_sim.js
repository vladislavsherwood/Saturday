/* tune5: шлифовка разворота BTC (правила 6, 7, 11 combo2) поверх combo2_sim.js.
   rev(p) — combo2-best с изменёнными параметрами разворота:
     T — порог btcr30 у всех трёх правил (T6, T7, T11 — по отдельности); a11 — действие правила 11 (2 = весь резерв, 1.9 = 90%);
     f6 — страх у исключения 6 (52), u6 — доля USDT у исключения 6 (7.6), a6 — действие исключения (1 = только взнос);
     F7 — фандинг у исключения 7 (2), a7 — действие исключения 7 (2 = весь резерв); no6 / no7 — убрать исключение.
   line(tag, S) — строка сравнения с combo2 (доход и строгая по сегментам, 100 новых). */
const Z = require('./combo2_sim.js'); const { c } = Z;
const OPT = { a1: true, as: true, cm2: true, b65: 'list' };
const S0 = Z.build(OPT);
const isR = (r) => r.conds.some((x) => x.ind === 'btcr30');
const kind = (r) => (r.conds.some((x) => x.ind === 'fng') ? 6 : r.conds.some((x) => x.ind === 'fund30') ? 7 : 11);
function rev(p = {}) {
  const rules = [];
  for (const r0 of S0.rules) {
    if (!isR(r0)) { rules.push(r0); continue; }
    const k = kind(r0); if ((k === 6 && p.no6) || (k === 7 && p.no7)) continue;
    const T = p['T' + k] ?? p.T ?? 20;
    const r = { act: r0.act, conds: r0.conds.map((x) => ({ ...x })) };
    for (const x of r.conds) {
      if (x.ind === 'btcr30') x.v = T;
      if (k === 6 && x.ind === 'fng') x.v = p.f6 ?? 52;
      if (k === 6 && x.ind === 'usdtd') x.v = p.u6 ?? 7.6;
      if (k === 7 && x.ind === 'fund30') x.v = p.F7 ?? 2;
    }
    if (k === 6) r.act = p.a6 ?? 1; if (k === 7) r.act = p.a7 ?? 2; if (k === 11) r.act = p.a11 ?? 2;
    rules.push(r);
  }
  return { base: S0.base, rules };
}
let G = null, b = null, bs = null;
function init() { if (!G) { G = Z.load(); b = Z.evc(G, S0); bs = Z.sum(b); } return { G, b, bs }; }
function evalS(S) {
  init(); const r = Z.evc(G, S), R = Z.sum(r);
  const inc = Object.fromEntries(Z.SEGS.map((s) => [s, +(Z.inc(R, s) - Z.inc(bs, s)).toFixed(4)]));
  const strict = Object.fromEntries(Z.SEGS.map((s) => [s, Z.strict(R, bs, s)]));
  const n = R.n100.all, ml = Z.mlog(r, b, 'all', ['n100']);
  return { inc, strict, ok: Z.SEGS.every((s) => !strict[s].length) && Z.SEGS.every((s) => inc[s] >= -1e-9), med: [R.sel.all.med, R.ex.all.med, R.rnd.all.med].map((x) => +x.toFixed(0)),
    n100: { med: +n.med.toFixed(0), pos: n.pos, hpos: n.hpos, bw: [ml.u, ml.d] }, pos: ['sel', 'ex', 'rnd'].map((g) => R[g].all.pos + '/' + R[g].all.hpos) };
}
function fmt(tag, o) {
  const segs = Z.SEGS.map((s) => `${s} ${(o.inc[s] >= 0 ? '+' : '') + o.inc[s].toFixed(3)}${o.strict[s].length ? '·' + o.strict[s].slice(0, 2).join(',') : '✔'}`).join(' | ');
  return `${o.ok ? 'OK' : '  '} ${tag.padEnd(26)} ${segs} | ${o.med.join('/')} | 100н ${o.n100.med} ${o.n100.pos}/${o.n100.hpos}`;
}
module.exports = { Z, c, OPT, S0, rev, evalS, fmt, init };
