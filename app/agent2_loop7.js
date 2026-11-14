/* Агент 2, круг 7: устойчивость широкой тихой вершины и продажи на страхе рядом с ней.
   H7a: окно роста доли альтов — 30/45/60/90/120 дней вместо 90 (если находка настоящая, плато должно держаться и на соседних окнах).
   H7b: доля альтов растёт «сейчас»: рост за 30 дней > 0 вместе с ростом за 90 дней (отсечь вершины, где альты уже сдуваются).
   H7c: при широкой тихой вершине переподобрать продажи на страхе (16/30% сейчас): 12/25%, 20/35%, 16/40%.
   База сравнения — основа; кандидат круга 5 — W25 (узкая 40% + широкая: BTC < 15% от максимума и альты > 1 п.п. за 90 дн → 25%).
   Запуск: node app/agent2_loop7.js */
const A = require('./agent2_sim.js');
const { c } = A;
A.EXTRA.push((X) => { const o = X.ind.othd, n = X.n; for (const w of [30, 45, 60, 120]) { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = i >= w ? o[i] - o[i - w] : NaN; X.ind['oth' + w] = a; } });
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iQT = M.findIndex((r) => A.has(r, 'qt')), QT = M[iQT];
const mk = (qtRules, f = (r) => r) => ({ ...A.MAIN, rules: [...M.slice(0, iQT), ...qtRules, ...M.slice(iQT + 1)].map(f) });
const W25 = mk([QT, { act: -0.25, conds: [c('btcath', '<', 15), c('oth90', '>', 1)] }]), w25 = A.ev(G, W25);
console.log(A.HDR); console.log(A.show('основа', base, base)); console.log(A.show('W25', w25, base) + ' | ' + A.why(w25, base));
const cell = (r) => `${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(2)}${A.passes(r, base) ? '✔' : ''}`;
const rows = [];
console.log('\nH7a: широкая (BTC < 15%) 40% одна и «узкая 40% + широкая 25%»; окно роста доли альтов × порог (п.п.)');
for (const two of [false, true]) for (const w of [30, 45, 60, 90, 120]) {
  const line = [];
  for (const o of [0.25, 0.5, 0.75, 1, 1.5, 2]) {
    const wide = { act: two ? -0.25 : -0.4, conds: [c('btcath', '<', 15), c('oth' + w, '>', o)] };
    const r = A.ev(G, mk(two ? [QT, wide] : [wide])); r.dd = A.d(r, base); r.tag = `${two ? 'узкая 40% + ' : ''}широкая: BTC < 15%, альты за ${w} дн > ${o} → ${two ? 25 : 40}%`; rows.push(r); line.push(`${o}:${cell(r)}`);
  }
  console.log(`  ${two ? 'узк+шир' : 'шир 40%'} окно ${String(w).padStart(3)} | ${line.join(' ')}`);
}
console.log('\nH7b: альты растут и сейчас (за 30 дн > 0)');
for (const o of [0.75, 1]) for (const two of [false, true]) { const wide = { act: two ? -0.25 : -0.4, conds: [c('btcath', '<', 15), c('oth90', '>', o), c('oth30', '>', 0)] };
  const r = A.ev(G, mk(two ? [QT, wide] : [wide])); r.dd = A.d(r, base); r.tag = `${two ? 'узкая 40% + ' : ''}широкая (альты 90 дн > ${o}, 30 дн > 0)`; rows.push(r); console.log(A.show(r.tag, r, base) + ' | ' + A.why(r, base)); }
console.log('\nH7c: продажи на страхе при W25 (сильный страх / страх)');
for (const [s1, s2] of [[0.3, 0.16], [0.25, 0.12], [0.35, 0.2], [0.4, 0.16], [0.3, 0.2], [0.25, 0.16], [0.3, 0.12]]) {
  const X = mk([QT, { act: -0.25, conds: [c('btcath', '<', 15), c('oth90', '>', 1)] }], (r) => (r.act === -0.3 ? { ...r, act: -s1 } : r.act === -0.16 ? { ...r, act: -s2 } : r));
  const r = A.ev(G, X); r.dd = A.d(r, base); r.tag = `W25, страх: сильный ${s1 * 100}%, обычный ${s2 * 100}%`; rows.push(r); console.log(A.show(r.tag, r, base) + ' | ' + A.why(r, base));
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop7.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
