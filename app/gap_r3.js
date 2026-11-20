/* gap, дыра 1: дна циклов в «хроническом» медвежьем рынке (12.2018, 06.2022, 11.2022) — доля альтов > 25%, паника в стейблах не включается,
   стратегия сидит в кэше (до 100%) и даже продаёт на страхе, а покупает только на развороте BTC (+20% за 30 дней) — на 50–80% выше дна.
   Признак зоны дна цикла: BTC ниже своего максимума больше чем на X% (btcath > X: 2015, 11.2018–03.2019, 03.2020, 06.2022–01.2023).
   Z1 — паника в зоне дна: btcath > X и usdt > 1,07 → взнос + f резерва (правило паники → отложенная паника по развороту usdt); Z2 — btcath > X и страх < 25 → + f;
   Z3 — в зоне дна не продавать на страхе (act 1). Правило первым. Критерий: доход > 0, строгая ✔, 100 новых > 0, соседи. Запуск: node gap_r3.js */
const L = require('./r4_lib.js'), { P, c } = L;
const S0 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
P.setBaseline(S0, L.pol0);
const F = (r) => { const S = L.clone(S0); S.rules.unshift(r); return S; };
const out = (r) => console.log(r.txt.slice(0, 120) + ' | ' + ((r.txt.match(/100н.*/) || [''])[0]).slice(0, 60) + (r.w ? ' | ' + r.w.slice(0, 90) : ''));
L.run('combo4 (57)', S0);
for (const X of [65, 70, 75]) for (const f of [0.1, 0.25, 0.5]) out(L.run(`Z1 btcath > ${X}, usdt > 1,07 → +${f * 100}%`, F({ act: 1 + f, conds: [c('btcath', '>', X), c('usdt', '>', 1.07)] }), L.pol0, { quiet: true, n100: true }));
for (const X of [65, 70, 75]) for (const f of [0.05, 0.1, 0.25]) out(L.run(`Z2 btcath > ${X}, страх < 25 → +${f * 100}%`, F({ act: 1 + f, conds: [c('btcath', '>', X), c('fng', '<', 25)] }), L.pol0, { quiet: true, n100: true }));
for (const X of [65, 70, 75]) out(L.run(`Z3 btcath > ${X} → не продавать (взнос)`, F({ act: 1, conds: [c('btcath', '>', X)] }), L.pol0, { quiet: true, n100: true }));
