/* h4, круг 5: «вход после дна» шире одного события — добавить «дней с ATH BTC > D» (дно цикла бывает через ~год после вершины),
   чтобы порог глубины можно было опустить (A 55–65) и поймать дно 2022–23, не задевая медвежьи отскоки 2018 и лета 2022.
   h4_dath — дней с последнего дня, когда BTC был в пределах 1% от ATH (по ряду BTC из отбора, по дате; до первого ATH в данных — нет значения).
   Запуск: node h4_r5.js [grid|ev|n100|nowick] */
const H = require('./h4_lib.js'), { L, S57, polW, c, G } = H;
const BX = G.sel.find((x) => x.name === 'BTC'), dath = new Map(); let last = -1;
for (let i = 0; i < BX.n; i++) { if (BX.ind.btcath[i] < 1) last = i; dath.set(BX.ind.t[i], last >= 0 ? i - last : NaN); }
L.addInd('h4_dath', (X) => Float64Array.from(X.ind.t, (t) => (dath.has(t) ? dath.get(t) : NaN)));
const arg = process.argv[2] || 'grid', NW = arg === 'nowick', pol = NW ? L.pol0 : polW;
H.setBase(S57, pol);
const mk = (A, U, f, D, Bm) => H.insertAt(S57, 1, [{ act: 1 + f, conds: [c('btcath', '>', A), c('btcup90', '>', U), ...(D ? [c('h4_dath', '>', D)] : []), ...(Bm ? [c('btc200', '<', Bm)] : [])] }]);
if (arg === 'ev') for (const [A, D, Bm] of [[55, 365, 1], [60, 365, 1], [65, 365, 1], [60, 365, 1.2], [60, 300, 1], [70, 0, 1]]) {
  let s = '', prev = -9; for (let i = 0; i < BX.n; i++) { const I = BX.ind, on = I.btcath[i] > A && I.btcup90[i] > 15 && (!D || dath.get(I.t[i]) > D) && (!Bm || I.btc200[i] < Bm); if (on) { if (i - prev > 1) s += ` ${L.day(I.t[i])}`; prev = i; } else if (prev === i - 1) s += `→${L.day(I.t[i - 1])}`; }
  console.log(`A${A} D${D} Bm${Bm}:${s}`); }
if (arg === 'grid') for (const A of [55, 60, 65, 70]) for (const D of [300, 365]) for (const Bm of [1, 1.2, 0]) H.run(`вход A${A} U15 f0.1 дней с ATH>${D} btc200<${Bm || '—'}`, mk(A, 15, 0.1, D, Bm), pol);
if (arg === 'n100' || NW) for (const [A, D, Bm] of [[60, 365, 1], [65, 365, 1], [60, 365, 1.2], [70, 0, 1]]) H.run(`вход A${A} U15 f0.1 D${D} btc200<${Bm}`, mk(A, 15, 0.1, D, Bm), pol, { n100: true });
