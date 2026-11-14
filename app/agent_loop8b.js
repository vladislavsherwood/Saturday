/* Круг 8, уточнение: плато размера продаж на тихой вершине (ровно и лесенкой) + по половинам истории.
   Запуск: node app/agent_loop8b.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const set = (S0, acts) => ({ ...S0, rules: S0.rules.map((r, i) => (acts[i] != null ? { ...r, act: acts[i] } : r)) });
const lad = (d, lo, hi) => ({ base: 1, rules: [...B.rules.slice(0, 11), { act: hi, conds: [c('qt', '>', 0.5), c('qtrun', '>', d)] }, { act: lo, conds: [c('qt', '>', 0.5)] }] });
const L = [{ tag: 'B (20%)', S: B }];
for (const q of [0.25, 0.3, 0.35, 0.4, 0.5]) L.push({ tag: `ровно ${q * 100}%`, S: set(B, { 11: -q }) });
for (const d of [5, 10, 15]) for (const [lo, hi] of [[0.2, 0.3], [0.2, 0.4], [0.2, 0.5], [0.15, 0.4], [0.25, 0.4]]) L.push({ tag: `первые ${d} дн по ${lo * 100}%, дальше ${hi * 100}%`, S: lad(d, -lo, -hi) });
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
// половины: медианы по h1/h2 на отборе+экзамене+50 случ.
const halfMed = (St, part) => S.med([...G.sel, ...G.ex, ...G.rnd].map((X) => S.E(X, St, part)));
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
console.log(S.HDR + ' | 100 новых | доход | ✔ | медиана 1-й / 2-й половины (81 монета)\n');
R.forEach((r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos}/${r.n100.hworst.toFixed(0)} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | ${halfMed(r.S, 'h1').toFixed(0)}/${halfMed(r.S, 'h2').toFixed(0)} | верх ${r.m.sellToTop.toFixed(1)}%/${r.m.missedTops.toFixed(0)}% | ${r.tag}`));
