/* tune2: проверка «вперёд по времени» (помощник окон imp8_sim.EW): для Y = 2021…2024 значение параметра выбирается по лог-медиане
   итогов монет (отбор + экзамен + 50 случайных) только до 1 января Y, затем сравнивается с combo2 после Y (монеты с ≥ 365 днями после Y).
   Запуск: node app/tune2_wf.js <параметр> <значения через запятую> [доп. параметры JSON] */
const T = require('./tune2_sim.js');
const I = require('./imp8_sim.js');
const k = process.argv[2], vals = process.argv[3].split(',').map(Number), extra = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const G = T.load(['sel', 'ex', 'rnd']), XS = [...G.sel, ...G.ex, ...G.rnd];
const lmw = (S, y0, y1) => { const v = XS.map((X) => I.EW(X, S, y0, y1)).filter((x) => x != null); return { lm: I.lm(v), n: v.length }; };
const S0 = T.build(T.P0);
const out = [];
for (const Y of [2021, 2022, 2023, 2024]) {
  const tr = vals.map((v) => ({ v, r: lmw(T.build({ ...extra, [k]: v }), null, Y) }));
  const best = tr.reduce((a, b) => (b.r.lm > a.r.lm + 1e-12 ? b : a));
  const te = lmw(T.build({ ...extra, [k]: best.v }), Y, null), te0 = lmw(S0, Y, null);
  const all = vals.map((v) => (lmw(T.build({ ...extra, [k]: v }), Y, null).lm - te0.lm).toFixed(3));
  console.log(`Y=${Y}: до Y лучшее ${k}=${best.v} (лог-мед ${best.r.lm.toFixed(3)}, монет ${best.r.n}); после Y: ${te.lm.toFixed(3)} против combo2 ${te0.lm.toFixed(3)} → Δ ${(te.lm - te0.lm >= 0 ? '+' : '') + (te.lm - te0.lm).toFixed(3)} (монет ${te.n}); Δ после Y по всем значениям: ${vals.map((v, i) => v + ':' + all[i]).join(' ')}`);
  out.push({ Y, best: best.v, d: te.lm - te0.lm });
}
console.log('Δ вне выборки: ' + out.map((o) => o.Y + ' ' + o.d.toFixed(3)).join(', '));
