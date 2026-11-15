/* tune4: проверка «вперёд по времени» для порогов моей части (помощник окон — app/imp8_sim.js, только чтение).
   Для Y = 2021…2024: обучение — окно «история монеты до 1 января Y» (старт с нуля), проверка — «с 1 января Y до конца».
   Монеты: отбор + экзамен + 50 случайных, окно ≥ 365 дней; мера — лог-медиана худшего из двух сдвигов.
   (а) значение параметра подбирается по обучению из сетки (при равенстве — ближе к combo2), выигрыш на проверке к combo2;
   (б) выигрыш фиксированного кандидата на проверке и обучении.
   Запуск: node app/tune4_wf.js '<JSON {параметр: [сетка]}>' '<JSON кандидат P>' [<JSON базовый P>] */
const I = require('./imp8_sim.js'); const T = require('./tune4_sim.js'); const { K } = I;
const G = T.load(); const ALL = [...G.sel, ...G.ex, ...G.rnd];
const score = (S, y0, y1) => { const e = ALL.map((X) => I.EW(X, S, y0, y1)).filter((v) => v != null); return I.lm(e); };
const grid = JSON.parse(process.argv[2]), cand = JSON.parse(process.argv[3] || '{}'), P0 = JSON.parse(process.argv[4] || '{}');
const S0 = T.build(G, P0), SC = T.build(G, { ...P0, ...cand });
const out = {}; let allA = true, allB = true;
for (const Y of [2021, 2022, 2023, 2024]) {
  const tr0 = score(S0, null, Y), te0 = score(S0, Y, null);
  let cur = { ...P0 }, best = tr0;
  for (const [k, vals] of Object.entries(grid)) {
    const d0 = T.D0[k] ?? 0; const base = P0[k] ?? d0;
    for (const v of [...vals].sort((a, b) => Math.abs(a - base) - Math.abs(b - base))) { const t = { ...cur, [k]: v }; const s = score(T.build(G, t), null, Y); if (s > best + 1e-9) { best = s; cur = t; } }
  }
  const teA = score(T.build(G, cur), Y, null), trC = score(SC, null, Y), teC = score(SC, Y, null);
  out[Y] = { pick: cur, trainGain: best - tr0, testGainPick: teA - te0, candTrain: trC - tr0, candTest: teC - te0 };
  if (teA - te0 < -1e-9) allA = false; if (teC - te0 < -1e-9) allB = false;
  console.log(`Y=${Y}: подбор ${JSON.stringify(Object.fromEntries(Object.keys(grid).map((k) => [k, cur[k] ?? T.D0[k]])))} обуч +${(best - tr0).toFixed(4)} → проверка ${(teA - te0).toFixed(4)} | кандидат: обуч ${(trC - tr0).toFixed(4)}, проверка ${(teC - te0).toFixed(4)}`);
}
console.log(`итог: подбор не хуже на всех Y: ${allA ? 'да' : 'нет'}; кандидат не хуже на всех Y: ${allB ? 'да' : 'нет'}`);
console.log('JSON ' + JSON.stringify(out));
