/* h4, круг 3: восстановление после глубокого дна (2019 Q1, 2023) — вход из резерва после разворота и запрет «мягких» продаж на страхе.
   (а) поэтапный вход после дна: BTC ниже ATH > A, BTC выше 90-дн. минимума на U%, BTC ещё ниже 200д → взнос + f резерва (в конце списка — только дни без сигнала; или первым);
   (б) тратить остаток резерва после подтверждённого разворота: BTC выше 200д, BTC ниже ATH > B, монета выше своей 200д → взнос + f (в конце списка / перед продажами на страхе 19–26);
   (в) в восстановлении не продавать на «мягком» страхе: перед правилами 19–26 — BTC выше 200д, BTC ниже ATH > B, страх > F → только взнос.
   Основа: combo4 + фитили. Запуск: node h4_r3.js [a|b|c] */
const H = require('./h4_lib.js'), { L, S57, polW, c } = H;
H.setBase(S57, polW);
const part = process.argv[2] || 'abc', END = 58;
if (part.includes('a')) for (const A of [60, 70]) for (const U of [15, 25]) for (const f of [0.03, 0.1]) for (const [pl, pos] of [['в конце', END], ['первым', 1]])
  H.run(`вход: ath>${A} up90>${U} btc200<1 → +${f} ${pl}`, H.insertAt(S57, pos, [{ act: 1 + f, conds: [c('btcath', '>', A), c('btcup90', '>', U), c('btc200', '<', 1)] }]), polW);
if (part.includes('b')) for (const B of [30, 40, 50]) for (const f of [0.02, 0.05, 0.1]) for (const [pl, pos] of [['в конце', END], ['перед 19', 19]])
  H.run(`остаток: btc200>1 ath>${B} sma200>1 → +${f} ${pl}`, H.insertAt(S57, pos, [{ act: 1 + f, conds: [c('btc200', '>', 1), c('btcath', '>', B), c('sma200', '>', 1)] }]), polW);
if (part.includes('c')) for (const B of [30, 40, 50]) for (const F of [40, 45]) H.run(`без продаж: btc200>1 ath>${B} fng>${F} → взнос перед 19`, H.insertAt(S57, 19, [{ act: 1, conds: [c('btc200', '>', 1), c('btcath', '>', B), c('fng', '>', F)] }]), polW);
