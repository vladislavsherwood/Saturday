/* imp4, круг 5. Проверка кандидата A («разворот BTC в жару — только взнос»): плато порога жадности, тест «правило только с даты D»,
   какие дни разворота он отменяет (по BTC), то же поверх combo2-best; сохраняет кандидатов для маржи (imp4_margin.py).
   Запуск: node app/imp4_loop5.js <out.json> <cands.json> */
const Z = require('./combo2_sim.js'); const { K, c } = Z;
const L = require('./imp4_lib.js');
const fs = require('fs');
const G = Z.load(['sel', 'ex', 'rnd', 'n100']);
const C2 = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const BASES = { 'combo-best': L.S0, 'combo2-best': { base: C2.base, rules: C2.rules } };
const isRev = (r) => r.act >= 2 && r.conds.some((x) => x.ind === 'btcr30' && x.op === '>');
const A = (S, T, a = 1, D = null, grp = null) => ({ ...S, rules: S.rules.flatMap((r) => (isRev(r) ? [{ act: a, conds: [...r.conds, c('fng', '>', T), ...(D ? [c('t', '>', L.tOf(D))] : [])], ...(grp != null ? { grp } : {}) }, r] : [r])) });
const OUT = {}, CANDS = {};
for (const [bn, S0] of Object.entries(BASES)) {
  const b = K.ev(G, S0, true);
  console.log(`\n== ${bn}: ${b.sel.med.toFixed(0)}/${b.ex.med.toFixed(0)}/${b.rnd.med.toFixed(0)} | 100н ${b.n100.med.toFixed(0)} ${b.n100.pos}/${b.n100.hpos} | ${K.fmtM(b.m)}`);
  CANDS[bn] = S0;
  const row = (t, S, withM = false) => { const r = K.ev(G, S, withM), [bt, wr] = K.bw(r, b, 'n100'); const o = { d: K.d(r, b), strict: K.passes(r, b), why: K.passes(r, b) ? '' : K.why(r, b), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, n100: r.n100.med, pos: r.n100.pos, h: r.n100.hpos, bw: [bt, wr], hw: [r.sel.hworst, r.ex.hworst, r.rnd.hworst], m: r.m };
    console.log(`${t} | ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)} ${o.strict ? '✔' : '· ' + o.why} | ${o.sel.toFixed(0)}/${o.ex.toFixed(0)}/${o.rnd.toFixed(0)} | 100н ${o.n100.toFixed(0)} ${o.pos}/${o.h} лучше/хуже ${bt}/${wr}${withM ? ' | ' + K.fmtM(r.m) : ''}`); return o; };
  OUT[bn] = {};
  for (const T of [70, 72, 75, 78, 80, 82, 85, 88, 90, 95]) OUT[bn]['T' + T] = row(`${bn} + A: жадн. > ${T} → только взнос`, A(S0, T));
  for (const D of ['2020-01-01', '2021-01-01', '2021-06-01', '2022-01-01', '2023-01-01']) OUT[bn]['D' + D] = row(`${bn} + A80 только с ${D}`, A(S0, 80, 1, D));
  OUT[bn].best = row(`${bn} + A80 (с метриками)`, A(S0, 80), true);
  CANDS[bn + ' + A80'] = A(S0, 80); CANDS[bn + ' + A80 без плеча'] = A(S0, 80, 1.5, null, 6);
}
// какие дни разворота отменяет A80 (по BTC; правило #18 «BTC +20% за 30 дн», решение по вчерашнему дню)
const B = G.sel.find((X) => X.name === 'BTC'), I = B.ind; const ds = [];
for (let j = 0; j < B.n; j++) if (I.btcr30[j] > 20 && I.fng[j] > 80) ds.push(B.t[j]);
const ep = []; for (const t of ds) { if (ep.length && t - ep[ep.length - 1].b < 10) { ep[ep.length - 1].b = t; ep[ep.length - 1].n++; } else ep.push({ a: t, b: t, n: 1 }); }
console.log('\nдни «BTC +20% за 30 дн и жадность > 80» (эпизоды): ' + ep.map((e) => `${L.day(e.a)}…${L.day(e.b)} (${e.n})`).join(', '));
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ OUT, ep: ep.map((e) => [L.day(e.a), L.day(e.b), e.n]) }, null, 1));
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(CANDS));
// вклад отдельных эпизодов: A80 разрешено только внутри одного эпизода жары (±5 дней)
if (process.env.IMP4_EP) {
  for (const [bn, S0] of Object.entries(BASES)) { const b = K.ev(G, S0, false);
    for (const e of ep) { const S = { ...S0, rules: S0.rules.flatMap((r) => (isRev(r) ? [{ act: 1, conds: [...r.conds, c('fng', '>', 80), c('t', '>', e.a - 5), c('t', '<', e.b + 5)] }, r] : [r])) };
      const r = K.ev(G, S, false); console.log(`${bn} A80 только ${L.day(e.a)}…${L.day(e.b)}: ${K.d(r, b) >= 0 ? '+' : ''}${K.d(r, b).toFixed(3)} ${K.passes(r, b) ? '✔' : '·'} | ${r.sel.med.toFixed(0)}/${r.ex.med.toFixed(0)}/${r.rnd.med.toFixed(0)} | 100н ${r.n100.med.toFixed(0)} ${r.n100.hpos}`); } }
}
