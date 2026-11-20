/* hv2, круг 1б: обрыв из-за PUMP создаёт пониженный порог пампа (300 → 200). Та же карта рампы при пороге пампа U 250 / 300 (300 — порог не меняется, только доли). */
const X = require('./hv2_lib.js'), { H } = X;
const line = (nm, r) => console.log(`${nm.padEnd(30)} доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} | БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) | 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} | PUMP ${r.pump.toFixed(0)}${r.why ? ' | ' + r.why.slice(0, 70) : ''}`);
for (const U of [300, 250]) for (const M of [2]) for (const cc of [100, 110, 120, 130, 140]) for (const w of [40, 80]) {
  const a = cc - w / 2, b = cc + w / 2; line(`U${U} рампа ${a}–${b} ×${M}`, X.run('', { gf: X.ramp(a, b), M, U }, { quiet: true }));
}
for (const U of [300, 250]) for (const T of [100, 110, 120]) line(`U${U} двоично T${T} ×2`, X.run('', { gf: X.step(T), U }, { quiet: true }));
