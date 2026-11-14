/* Круг 7: не продавать у дна. Продажи на страхе (правила 7, 8) идут и глубоко в медвежьем рынке, когда цена уже у дна.
   H7a — продавать на страхе только пока биткоин недалеко от максимума (btcath < X), глубже — только взнос;
   H7b — то же по самой монете (dd365 < X); H7c — глубже порога продавать вдвое меньше (лесенка продаж по глубине).
   Запуск: node app/agent_loop7.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
{ const agg = {}; for (const X of [...G.sel, ...G.ex, ...G.rnd]) { const { tr } = S.edge(X, B, 0, 'full', true); for (const t of tr) if (t.s < 0 && (t.q === 7 || t.q === 8)) { const b = Math.min(4, Math.floor(X.ind.btcath[t.i - 1] / 20)); const M = X.M || null; (agg[b] = agg[b] || { n: 0, amt: 0, top: 0 }); agg[b].n++; agg[b].amt += t.amt; } }
  console.log('продажи на страхе по глубине просадки биткоина (btcath, корзины по 20%): ' + Object.entries(agg).map(([k, v]) => `${k * 20}–${k * 20 + 20}%: ${v.n} сделок`).join(', ')); }
const L = [{ tag: 'B', S: B }];
for (const ind of ['btcath', 'dd365']) for (const T of [30, 40, 50, 60, 70]) for (const k of [0, 0.5]) {
  const rules = []; B.rules.forEach((r, i) => { if (i === 7 || i === 8) { if (k) rules.push({ act: +(r.act * k).toFixed(3), conds: [...r.conds, c(ind, '>', T)] }); else rules.push({ act: 1, conds: [...r.conds, c(ind, '>', T)] }); rules.push(r); } else rules.push(r); });
  // для k=0 одно правило «глубоко — только взнос» достаточно один раз (перед правилом 7), второе дублирует — уберём дубль
  const seen = new Set(), rr = rules.filter((r) => { const key = JSON.stringify(r); if (seen.has(key)) return false; seen.add(key); return true; });
  L.push({ tag: `${k ? 'H7c' : ind === 'btcath' ? 'H7a' : 'H7b'}: страх при ${ind} > ${T} → ${k ? 'продавать вдвое меньше' : 'только взнос'}`, ind, T, k, S: { base: 1, rules: rr } });
}
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S, true) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | продажи к вершине ${r.m.sellToTop.toFixed(0)}%, пропущено ${r.m.missedTops.toFixed(0)}%, мин.отб ${r.sel.worst.toFixed(0)}, мин.экз ${r.ex.worst.toFixed(0)} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых | доход | ✔ | метрики\n'); R.forEach(out);
