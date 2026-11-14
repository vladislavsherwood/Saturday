/* Круг 3: продавать ближе к вершине и не пропускать крупные вершины.
   Продажи B почти целиком — на страхе (уже после вершины, 69–74% от максимума); ближе всех к вершине — тихая вершина (81%).
   H3a — перегрев самой монеты (RSI, цена к средней 200, рост за 30 дней, рост от минимума за 90 дней) → продать понемногу каждый день;
   H3b — жадность рынка (страх и жадность > 75…85), отдельно и вместе с перегревом монеты;
   H3c — место нового правила: в конце списка или перед продажами на страхе.
   Запуск: node app/agent_loop3.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const SIG = { 'RSI>80': [c('rsi', '>', 80)], 'RSI>85': [c('rsi', '>', 85)], 'RSI>75': [c('rsi', '>', 75)], 'монета > 2× средней 200': [c('sma200', '>', 2)], 'монета > 2,5× средней 200': [c('sma200', '>', 2.5)],
  'монета > 3× средней 200': [c('sma200', '>', 3)], 'монета +100% за 30 дн': [c('ret30', '>', 100)], 'монета +60% за 30 дн': [c('ret30', '>', 60)], 'монета 3× от мин. 90 дн': [c('up90', '>', 200)],
  'монета 4× от мин. 90 дн': [c('up90', '>', 300)], 'жадность > 75': [c('fng', '>', 75)], 'жадность > 80': [c('fng', '>', 80)], 'жадность > 85': [c('fng', '>', 85)],
  'жадность > 75 и монета > 2× средней 200': [c('fng', '>', 75), c('sma200', '>', 2)], 'жадность > 70 и RSI>80': [c('fng', '>', 70), c('rsi', '>', 80)], 'жадность > 75 и монета 3× от мин. 90': [c('fng', '>', 75), c('up90', '>', 200)] };
const L = [{ tag: 'B', S: B }];
for (const sn in SIG) for (const a of [-0.02, -0.05, -0.1, -0.2]) for (const pos of ['конец', 'перед страхом']) {
  const rules = [...B.rules], nr = { act: a, conds: SIG[sn] };
  if (pos === 'конец') rules.push(nr); else rules.splice(7, 0, nr);
  L.push({ tag: `${sn} → продать ${-a * 100}% (${pos})`, sn, S: { base: 1, rules } });
}
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | продажи к вершине ${r.m.sellToTop.toFixed(0)}%, пропущено ${r.m.missedTops.toFixed(0)}%, мин.отб ${r.sel.worst.toFixed(0)} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых | доход | ✔ | метрики\n'); out(b);
console.log('\n--- проходят ---'); R.slice(1).filter((r) => S.passes(r, b)).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 15).forEach(out);
console.log('\n--- лучшие по доходу ---'); R.slice(1).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
console.log('\n--- меньше всего пропущенных вершин при доходе не хуже B − 0,05 ---'); R.slice(1).filter((r) => S.inc(r) > S.inc(b) - 0.05).sort((x, y) => x.m.missedTops - y.m.missedTops || S.inc(y) - S.inc(x)).slice(0, 10).forEach(out);
console.log('\n--- средний доход по сигналу ---');
for (const sn in SIG) { const v = R.filter((r) => r.sn === sn); console.log(`  ${sn.padEnd(40)} доход ${(v.reduce((s, r) => s + S.inc(r) - S.inc(b), 0) / v.length).toFixed(3)}, лучший ${Math.max(...v.map((r) => S.inc(r) - S.inc(b))).toFixed(3)}, проходят ${v.filter((r) => S.passes(r, b)).length}/${v.length}, пропущено вершин ${(v.reduce((s, r) => s + r.m.missedTops, 0) / v.length).toFixed(1)}%`); }
