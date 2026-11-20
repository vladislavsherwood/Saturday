/* hv2, круг 1: обрыв по порогу. Плавный вес режима g = clamp((hvv − a) / (b − a), 0, 1): множитель доли 1 + (M − 1)·g и порог пампа 300 − 100·g.
   Карта: центр (a + b)/2 × ширина b − a × M; для сравнения — двоичный порог T 100…130 (hv). Ступени — 2–3 ступени. */
const X = require('./hv2_lib.js'), { H } = X;
const rows = [];
const line = (nm, r) => { const s = `${nm.padEnd(26)} доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} | БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) | 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} | крупн ${H.sg(r.bigWorst, 3)} | PUMP ${r.pump.toFixed(0)}${r.why ? ' | ' + r.why.slice(0, 70) : ''}`; console.log(s); rows.push(s); };
console.log('combo5: PUMP', H.E(H.BY.PUMP, H.S5, H.polW).toFixed(1));
for (const T of [100, 110, 115, 120, 130]) line(`двоично T${T} ×2`, X.run('', { gf: X.step(T) }, { quiet: true }));
for (const M of [2, 1.5]) for (const cc of [100, 110, 120, 130, 140]) for (const w of [20, 40, 60, 80]) {
  const a = cc - w / 2, b = cc + w / 2; line(`рампа ${a}–${b} ×${M}`, X.run('', { gf: X.ramp(a, b), M }, { quiet: true }));
}
for (const [nm, st] of [['3 ступени 100/120/140', [[100, 1 / 3], [120, 2 / 3], [140, 1]]], ['2 ступени 110/130', [[110, 0.5], [130, 1]]], ['3 ступени 90/120/150', [[90, 1 / 3], [120, 2 / 3], [150, 1]]], ['2 ступени 100/140', [[100, 0.5], [140, 1]]]])
  for (const M of [2, 1.5]) line(`${nm} ×${M}`, X.run('', { gf: X.steps(st), M }, { quiet: true }));
