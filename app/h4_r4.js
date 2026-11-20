/* h4, круг 4: «вход после дна» (лучшее из круга 3а) — плато и 100 новых.
   Правило первым: BTC ниже ATH > A, BTC выше 90-дн. минимума > U%, BTC ниже своей 200д (btc200 < Bm) → взнос + f резерва.
   Варианты места: первым / перед продажами на сильном страхе (11) / перед 19. Основа: combo4 + фитили (и combo4 без фитилей — аргумент nowick).
   Запуск: node h4_r4.js [grid|n100|nowick|place] */
const H = require('./h4_lib.js'), { L, S57, polW, c } = H;
const arg = process.argv[2] || 'grid';
const NW = arg === 'nowick';
H.setBase(S57, NW ? L.pol0 : polW);
const pol = NW ? L.pol0 : polW;
const mk = (A, U, f, pos = 1, Bm = 1, extra = []) => H.insertAt(S57, pos, [{ act: 1 + f, conds: [c('btcath', '>', A), c('btcup90', '>', U), ...(Bm ? [c('btc200', '<', Bm)] : []), ...extra] }]);
if (arg === 'grid') for (const A of [65, 70, 75]) for (const U of [10, 15, 20]) for (const f of [0.03, 0.1, 0.25]) H.run(`вход A${A} U${U} f${f}`, mk(A, U, f), pol);
if (arg === 'place') { for (const [pl, pos] of [['перед 2', 2], ['перед 4', 4], ['перед 11', 11], ['перед 19', 19]]) H.run(`вход A70 U15 f0.1 ${pl}`, mk(70, 15, 0.1, pos), pol);
  for (const Bm of [0.9, 1.1, 0]) H.run(`вход A70 U15 f0.1 btc200<${Bm || '—'}`, mk(70, 15, 0.1, 1, Bm), pol);
  H.run('вход A70 U15 f0.1 + монета выше 90-дн. мин. (up90 > 15)', mk(70, 15, 0.1, 1, 1, [c('up90', '>', 15)]), pol);
  H.run('вход A70 U15 f0.1 только крупные', mk(70, 15, 0.1, 1, 1, [c('isbig', '>', 0.5)]), pol); }
if (arg === 'n100' || NW) for (const [A, U, f] of [[70, 15, 0.03], [70, 15, 0.1], [70, 15, 0.25], [75, 15, 0.1], [70, 10, 0.1], [70, 20, 0.1]]) H.run(`вход A${A} U${U} f${f}`, mk(A, U, f), pol, { n100: true });
