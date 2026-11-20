/* hx: кандидаты дыр вместе — h2 «удержание после капитуляции» (11-м) и h4 «вход после дна» (первым), поверх combo4 (57) + фитили и поверх combo4.
   Запуск: node hx_combo.js */
require('./h2_lib.js'); // индикатор h2fd15 (дней с последнего страха < 15)
const L = require('./r4_lib.js'), { P, c } = L;
const S57 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const polW = { ...L.pol0, wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } };
const H2 = { act: 1, conds: [c('h2fd15', '<', 60), c('mvrv', '<', 1), c('age', '>', 180), c('meme', '<', 0.5), c('btcr30', '<', 20)] };
const H4 = { act: 1.1, conds: [c('btcath', '>', 75), c('btcup90', '>', 15), c('btc200', '<', 1)] };
const mk = (h2, h4) => { const S = L.clone(S57); if (h2) S.rules.splice(10, 0, JSON.parse(JSON.stringify(H2))); if (h4) S.rules.unshift(JSON.parse(JSON.stringify(H4))); return S; };
const out = (r) => console.log(r.txt.slice(0, 200) + ' | ' + ((r.txt.match(/100н.*/) || [''])[0]).slice(0, 70));
for (const [bn, pol] of [['combo4 + фитили', polW], ['combo4', L.pol0]]) {
  P.setBaseline(S57, pol); console.log(`\n=== основа: ${bn} ===`);
  for (const [nm, a, b] of [['+ h2 удержание', 1, 0], ['+ h4 вход после дна', 0, 1], ['+ h2 + h4', 1, 1]]) out(L.run(nm, mk(a, b), pol, { quiet: true, n100: true }));
}
