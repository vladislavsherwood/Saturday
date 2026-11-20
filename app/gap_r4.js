/* gap, дыра 1, уточнение: зона дна цикла только для крупных (BTC, ETH, SOL…: isbig) — у них прибавка +0,3…+0,4 устойчива; и соседи. Запуск: node gap_r4.js */
const L = require('./r4_lib.js'), { P, c } = L;
const S0 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
P.setBaseline(S0, L.pol0);
const F = (r) => { const S = L.clone(S0); S.rules.unshift(r); return S; };
const out = (r) => console.log(r.txt.slice(0, 120) + ' | ' + ((r.txt.match(/100н.*/) || [''])[0]).slice(0, 60) + (r.w ? ' | ' + r.w.slice(0, 120) : ''));
L.run('combo4 (57)', S0);
for (const X of [60, 65, 70, 75]) for (const q of [20, 25, 30]) for (const f of [0.1, 0.25]) out(L.run(`крупные: btcath > ${X}, страх < ${q} → +${f * 100}%`, F({ act: 1 + f, conds: [c('isbig', '>', 0.5), c('btcath', '>', X), c('fng', '<', q)] }), L.pol0, { quiet: true, n100: true }));
for (const X of [65, 70, 75]) for (const f of [0.1, 0.25]) out(L.run(`крупные: btcath > ${X}, usdt > 1,07 → +${f * 100}%`, F({ act: 1 + f, conds: [c('isbig', '>', 0.5), c('btcath', '>', X), c('usdt', '>', 1.07)] }), L.pol0, { quiet: true, n100: true }));
