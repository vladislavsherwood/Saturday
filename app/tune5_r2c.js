/* tune5, круг 2в: порог разворота «вперёд по времени» (помощник окон imp8_sim.EW): для Y = 2021…2024 обучение — история до 1 января Y,
   проверка — с 1 января Y (старт с нуля, худший из двух сдвигов, окно ≥ 365 дней), монеты отбор + экзамен + 50 случайных; основа combo2,
   меняется только общий порог btcr30 у правил 6, 7, 11. Запуск: node app/tune5_r2c.js */
const T = require('./tune5_sim.js'); const I = require('./imp8_sim.js'); const { G } = T.init();
const ALL = [...G.sel, ...G.ex, ...G.rnd];
const score = (S, y0, y1) => { const e = ALL.map((X) => I.EW(X, S, y0, y1)).filter((v) => v != null); return { lm: I.lm(e), n: e.length, pos: e.filter((v) => v > 0).length }; };
const TS = [15, 17.5, 18, 18.5, 19, 19.25, 19.5, 20, 20.5, 21, 22.5];
for (const Y of [2021, 2022, 2023, 2024]) {
  const rows = TS.map((v) => { const S = T.rev({ T: v }); return [v, score(S, null, Y), score(S, Y, null)]; });
  const b20 = rows.find((r) => r[0] === 20); const best = rows.reduce((a, r) => (r[1].lm > a[1].lm + 1e-9 ? r : a));
  console.log(`Y=${Y}: подбор по прошлому → ${best[0]}; проверка Δlm к 20: ` + rows.map((r) => `${r[0]}: ${(r[2].lm - b20[2].lm >= 0 ? '+' : '') + (r[2].lm - b20[2].lm).toFixed(3)} (обуч ${(r[1].lm - b20[1].lm >= 0 ? '+' : '') + (r[1].lm - b20[1].lm).toFixed(3)})`).join(' | '));
}
