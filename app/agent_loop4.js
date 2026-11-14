/* Круг 4: «рано продали» — обратный выкуп.
   Продажи на страхе (правила 7, 8) — 84% денег продаж. Если страх быстро прошёл, а разворота биткоина на +20% за месяц нет, резерв
   долго лежит без дела. H4a — страх сменился нейтралом/жадностью вскоре после продаж (fearoff — дней с последнего дня страха) → вернуть часть резерва;
   H4b — другой порог/окно разворота биткоина; H4c — монета вернулась выше средней 200 вскоре после продаж.
   Сначала — сколько продаж на страхе оказались «ранними» (через 60 дней цена выше продажи на 20%+). Запуск: node app/agent_loop4.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
{ let n = 0, early = 0, amt = 0, eamt = 0; for (const X of [...G.sel, ...G.ex, ...G.rnd]) { const { tr } = S.edge(X, B, 0, 'full', true); for (const t of tr) if (t.s < 0 && (t.q === 7 || t.q === 8) && t.i + 60 < X.n) { n++; amt += t.amt; if (X.c[t.i + 60] > 1.2 * t.p) { early++; eamt += t.amt; } } }
  console.log(`продаж на страхе ${n}; через 60 дней цена на 20%+ выше: ${(100 * early / n).toFixed(0)}% продаж, ${(100 * eamt / amt).toFixed(0)}% денег\n`); }
const L = [{ tag: 'B', S: B }];
const ins = (rule, at) => { const r = [...B.rules]; if (at === 'end') r.push(rule); else r.splice(at, 0, rule); return { base: 1, rules: r }; };
for (const f of [55, 60, 65]) for (const off of [14, 30, 60]) for (const a of [1.1, 1.25, 1.5]) for (const at of [10, 'end'])
  L.push({ h: 'H4a', tag: `H4a: страх и жадность > ${f}, страх был ≤ ${off} дн назад → резерв ${Math.round((a - 1) * 100)}% (${at === 'end' ? 'в конце' : 'перед фандингом'})`, S: ins({ act: a, conds: [c('fng', '>', f), c('fearoff', '<', off)] }, at) });
for (const [k, v] of [['btcr30', 10], ['btcr30', 15], ['btcr30', 25], ['btcr14', 10], ['btcr14', 15], ['btcr21', 15], ['btcr45', 25], ['btcr60', 30]]) for (const a of [1.5, 2]) {
  const rules = B.rules.map((r, i) => ([4, 5, 9].includes(i) ? { ...r, conds: r.conds.map((q) => (q.ind === 'btcr30' ? c(k, '>', v) : q)), act: i === 4 ? 1 : a } : r));
  L.push({ h: 'H4b', tag: `H4b: разворот ${k} > ${v}, резерв ${Math.round((a - 1) * 100)}%`, S: { base: 1, rules } });
}
for (const sm of [1, 1.1]) for (const off of [30, 60]) for (const a of [1.1, 1.25]) L.push({ h: 'H4c', tag: `H4c: монета > ${sm}× средней 200, страх был ≤ ${off} дн назад → резерв ${Math.round((a - 1) * 100)}%`, S: ins({ act: a, conds: [c('sma200', '>', sm), c('fearoff', '<', off), c('fng', '>', 52)] }, 10) });
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | выше мин. ${r.m.buyAbove90.toFixed(0)}%, в зоне ${r.m.zone15.toFixed(0)}%, мин.отб ${r.sel.worst.toFixed(0)} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых | доход | ✔ | метрики\n'); out(b);
console.log('\n--- проходят ---'); R.slice(1).filter((r) => S.passes(r, b)).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
for (const h of ['H4a', 'H4b', 'H4c']) { console.log(`\n--- ${h}: лучшие по доходу ---`); R.filter((r) => r.h === h).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 8).forEach(out); }
console.log('\n--- H4b целиком ---'); R.filter((r) => r.h === 'H4b').forEach(out);
