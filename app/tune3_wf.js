/* tune3: проверка «вперёд по времени» (по образцу imp8): для каждого Y = 2021…2024 значение параметра выбирается по данным ДО Y
   (старт с нуля, медиана итога к DCA по отбору+экзамену+50 случ., худший из двух сдвигов, окно ≥ 365 дн), а оценивается ПОСЛЕ Y
   (старт с нуля 1 января Y до конца) — разница лог-медиан к текущему значению. Также — прямой выигрыш кандидата до/после Y.
   Запуск: node app/tune3_wf.js '{"fu":[1.9,2,2.1,2.2]}' '{"текущие": ...}' '{"кандидат": ...}' */
const T = require('./tune3_sim.js'); const I = require('./imp8_sim.js');
const grid = JSON.parse(process.argv[2]), cur = JSON.parse(process.argv[3] || '{}'), cand = JSON.parse(process.argv[4] || 'null');
const G = T.load(['sel', 'ex', 'rnd']); const ALL = [...G.sel, ...G.ex, ...G.rnd];
const YS = [2021, 2022, 2023, 2024];
const k = Object.keys(grid)[0];
const lmw = (S, y0, y1) => I.lm(ALL.map((X) => I.EW(X, S, y0, y1)).filter((v) => v != null));
const tab = (o) => { const S = T.build({ ...cur, ...o }); return YS.map((y) => [lmw(S, null, y), lmw(S, y, null)]); };
const base = tab({}); const rows = grid[k].map((v) => [v, tab({ [k]: v })]);
const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
console.log(`параметр ${k}; текущее ${JSON.stringify(cur)}; разница лог-медиан к текущему (до Y | после Y)`);
for (const [v, t] of rows) console.log(String(v).padEnd(8), YS.map((y, i) => `${y}: ${f(t[i][0] - base[i][0])} | ${f(t[i][1] - base[i][1])}`).join('   '));
const out = [];
YS.forEach((y, i) => { let best = rows[0]; for (const r of rows) if (r[1][i][0] > best[1][i][0] + 1e-9) best = r; out.push(`${y}: выбрано до Y ${best[0]} → после Y ${f(best[1][i][1] - base[i][1])}`); });
console.log('вперёд по времени: ' + out.join('; '));
if (cand) { const t = tab(cand); console.log('кандидат ' + JSON.stringify(cand) + ': ' + YS.map((y, i) => `${y}: ${f(t[i][0] - base[i][0])} | ${f(t[i][1] - base[i][1])}`).join('   ')); }
