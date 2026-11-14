/* Круг 3, уточнение: продажа на жадности в конце списка (после разворота и тихой вершины) — плато порога и размера, 100 новых.
   Запуск: node app/agent_loop3b.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const L = [{ tag: 'B', S: B }];
for (const g of [65, 70, 72, 75, 78, 80, 85]) for (const a of [-0.02, -0.05, -0.1, -0.15, -0.2, -0.3]) L.push({ tag: `жадность > ${g} → продать ${-a * 100}%`, g, a, S: { base: 1, rules: [...B.rules, { act: a, conds: [c('fng', '>', g)] }] } });
for (const g of [70, 75, 80]) for (const a of [-0.05, -0.1]) for (const [k, v] of [['sma200', 1.5], ['sma200', 1.2], ['btcath', 20]]) L.push({ tag: `жадность > ${g} и ${k}${k === 'btcath' ? '<' : '>'}${v} → продать ${-a * 100}%`, S: { base: 1, rules: [...B.rules, { act: a, conds: [c('fng', '>', g), c(k, k === 'btcath' ? '<' : '>', v)] }] } });
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos}/${r.n100.hworst.toFixed(0)} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | к вершине ${r.m.sellToTop.toFixed(0)}%, пропущено ${r.m.missedTops.toFixed(0)}%, мин.отб ${r.sel.worst.toFixed(0)}, мин.экз ${r.ex.worst.toFixed(0)} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых мед/плюс/пол+ | доход | ✔ | метрики\n'); R.forEach(out);
