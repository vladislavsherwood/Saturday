/* hv2, круг 5: карта чувствительности рампы (порог пампа U 250, список крупных): начало a × конец b × доля M; ступенчатые версии (для записи правилами). */
const X = require('./hv2_lib.js'), { H } = X;
const cell = (r) => `${r.ok ? '✔' : '✗'} ${H.sg(r.hv81.m, 3)}/${H.sg(r.nhv.m, 3)} P${r.pump.toFixed(0)}`;
let ok = 0, n = 0, pumpBad = 0;
for (const M of [2, 1.5, 2.5]) {
  console.log(`\nM ×${M}: строгая, БД81/БД100н, PUMP (combo5 85)`);
  const As = M === 2 ? [80, 85, 90, 95, 100, 105, 110, 115] : [90, 100, 110], Bs = M === 2 ? [125, 130, 135, 140, 150, 160, 180] : [130, 140, 150];
  console.log('a \\ b'.padEnd(7) + Bs.map((b) => String(b).padEnd(26)).join(''));
  for (const a of As) { let s = String(a).padEnd(7); for (const b of Bs) { const r = X.run('', { gf: X.ramp(a, b), U: 250, M }, { quiet: true }); s += cell(r).padEnd(26); n++; if (r.ok) ok++; if (r.pump < 81.3) pumpBad++; } console.log(s); }
}
console.log(`\nвсего клеток ${n}, строгая ✔ ${ok} (${(100 * ok / n).toFixed(0)}%), PUMP хуже combo5 больше 0,02 лога: ${pumpBad}`);
console.log('\nСтупени (U 250, ×2): вес ступени — значение рампы 100–140 в середине интервала');
const ST = { '2 ступени: >110 → ½, >130 → 1': [[110, 0.5], [130, 1]], '3 ступени: >105 → ⅓, >120 → ⅔, >135 → 1': [[105, 1 / 3], [120, 2 / 3], [135, 1]],
  '3 ступени: >110 → ⅓, >120 → ⅔, >130 → 1': [[110, 1 / 3], [120, 2 / 3], [130, 1]], '4 ступени: >100 → ⅛, >110 → ⅜, >120 → ⅝, >130 → ⅞, >140 → 1': [[100, 1 / 8], [110, 3 / 8], [120, 5 / 8], [130, 7 / 8], [140, 1]],
  '4 ступени: >105 → ¼, >115 → ½, >125 → ¾, >135 → 1': [[105, 0.25], [115, 0.5], [125, 0.75], [135, 1]] };
for (const [nm, st] of Object.entries(ST)) for (const M of [2, 1.5]) { const r = X.run('', { gf: X.steps(st), U: 250, M }, { quiet: true }); console.log(`${nm} ×${M}`.padEnd(64), `доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} PUMP ${r.pump.toFixed(0)}${r.why ? ' | ' + r.why.slice(0, 60) : ''}`); }
// сдвиг ступеней 4×: ±5
for (const d of [-10, -5, 5, 10]) { const st = [[105 + d, 0.25], [115 + d, 0.5], [125 + d, 0.75], [135 + d, 1]]; const r = X.run('', { gf: X.steps(st), U: 250 }, { quiet: true }); console.log(`4 ступени со сдвигом ${d > 0 ? '+' : ''}${d}`.padEnd(64), `доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} БД81 ${H.sg(r.hv81.m, 3)} БД100н ${H.sg(r.nhv.m, 3)} PUMP ${r.pump.toFixed(0)}${r.why ? ' | ' + r.why.slice(0, 60) : ''}`); }
