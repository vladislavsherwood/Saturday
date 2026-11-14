/* Круг 6: осторожные шорты на сильных сигналах вершины (по каждой монете, спотовая кросс-маржа с её лонгом и резервом).
   Шорт = занять монету и продать; проценты по займу 15% годовых, комиссия 0,1% на вход и выход; ликвидация, если (резерв + выручка шорта +
   лонг по минимуму дня) / (шорт по максимуму дня) ≤ 1,1. Стресс: максимумы на 20% и 30% выше (и минимумы на столько же ниже).
   Вход: тихая вершина, перегретый фандинг, жадность; выход: сигналы дна (паника/капитуляция/ликвидации), разворот BTC вверх, погас сигнал, срок.
   Запуск: node app/agent_loop6.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const ENTRY = { 'тихая вершина': [[c('qt', '>', 0.5)]], 'перегретый фандинг': [[c('fund30', '>', 2)]], 'тихая вершина и фандинг > 1%': [[c('qt', '>', 0.5), c('fund30', '>', 1)]],
  'жадность > 75': [[c('fng', '>', 75)]], 'тихая вершина или перегретый фандинг': [[c('qt', '>', 0.5)], [c('fund30', '>', 2)]] };
const BOT = [[c('usdt', '>', 1.07), c('othd', '<', 25)], [c('fng', '<', 10)], [c('oidd30', '<', -28)]], RB = [[c('btcr30', '>', 20)]];
const EXIT = { 'дно или разворот BTC': [...BOT, ...RB], 'страх (начало падения) или дно': [[c('fng', '<', 52), c('usdtd', '<', 7.6)], ...BOT],
  'сигнал входа погас': null, 'срок 30 дн / дно': [...BOT], 'срок 90 дн / дно': [...BOT] };
const neg = { 'тихая вершина': [[c('qt', '<', 0.5)]], 'перегретый фандинг': [[c('fund30', '<', 2)]], 'тихая вершина и фандинг > 1%': [[c('qt', '<', 0.5)], [c('fund30', '<', 1)]], 'жадность > 75': [[c('fng', '<', 75)]], 'тихая вершина или перегретый фандинг': [[c('qt', '<', 0.5), c('fund30', '<', 2)]] };
const L = [{ tag: 'B без шортов', S: B }];
for (const en in ENTRY) for (const ex in EXIT) for (const size of [0.02, 0.05, 0.1, 0.2]) {
  const maxd = ex.startsWith('срок 30') ? 30 : ex.startsWith('срок 90') ? 90 : 0;
  L.push({ tag: `шорт ${size * 100}% капитала: вход «${en}», выход «${ex}»`, en, ex, size, S: { ...B, short: { entry: ENTRY[en], exit: EXIT[ex] || neg[en], size, rate: 0.15 / 365, maxd } } });
}
const liqs = (St, hs) => [...G.sel, ...G.ex, ...G.rnd, ...G.n100].reduce((s, X) => s + S.edge(X, St, 0, 'full', false, hs).liq + S.edge(X, St, 1, 'full', false, hs).liq, 0);
const R = L.map((x) => ({ ...x, ...S.evalAll(G, x.S), l0: liqs(x.S, 1), l20: liqs(x.S, 1.2), l30: liqs(x.S, 1.3) })), b = R[0];
const d = (r) => (S.inc(r) - S.inc(b) >= 0 ? '+' : '') + (S.inc(r) - S.inc(b)).toFixed(3);
const out = (r) => console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} | ${d(r)} ${S.passes(r, b) ? '✔' : '·'} | ликвидаций ${r.l0}/${r.l20}/${r.l30} | ${r.tag}`);
console.log(S.HDR + ' | 100 новых | доход | ✔ | ликвидаций (как есть / +20% / +30%) на 181 монете × 2 сдвига\n'); out(b);
console.log('\n--- проходят, без ликвидаций в стрессе ---'); R.slice(1).filter((r) => S.passes(r, b) && r.l30 === 0).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
console.log('\n--- лучшие по доходу ---'); R.slice(1).sort((x, y) => S.inc(y) - S.inc(x)).slice(0, 12).forEach(out);
console.log('\n--- средний доход по входу и выходу ---');
for (const k of ['en', 'ex', 'size']) { const g = {}; R.slice(1).forEach((r) => (g[r[k]] = g[r[k]] || []).push(r)); for (const v in g) console.log(`  ${k} ${v}: доход ${(g[v].reduce((s, r) => s + S.inc(r) - S.inc(b), 0) / g[v].length).toFixed(3)}, 100 новых мед. ${(g[v].reduce((s, r) => s + r.n100.med, 0) / g[v].length).toFixed(0)}, ликв. в стрессе +30%: ${g[v].reduce((s, r) => s + r.l30, 0)}`); }
