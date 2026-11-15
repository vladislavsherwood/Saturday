/* Круг 14: заменить подгонку «возраст > 540» (поверх k 0). Кому откладывать: всем; монетам, видевшим ≥ E эпизодов паники до текущего (история длиннее одного цикла паники);
   с волатильностью за 180 дн. < V; возраст 180/365/540/730. Сравнение — к кандидату k 0 (age 540) и к C3. Запуск: node panicx_r14.js */
const H = require('./panicx_p2.js'), P = H.P;
H.init();
P.setBaseline(P.base, H.Pol2({ k: 0 })); console.log('новая основа круга: k 0, age > 540');
const why = (pol) => pol;
for (const A of [0, 180, 365, 450, 540, 730]) H.run(`возраст > ${A}`, H.Pol2({ k: 0, gate: 'age', A }));
for (const E of [1, 2, 3, 4]) H.run(`эпизодов до этого ≥ ${E}`, H.Pol2({ k: 0, gate: 'eps', E }));
for (const V of [70, 90, 110, 130]) H.run(`vol180 < ${V}`, H.Pol2({ k: 0, gate: 'vol', V }));
// распределение: сколько эпизодов видели HYPE/PUMP к концу, и когда у основы монет наступает 2-й эпизод
const G = H.G; for (const nm of ['HYPE', 'PUMP', 'TON', 'ARIA', 'SOL']) { const X = [...G.sel, ...G.rnd].find((x) => x.name === nm); if (X) console.log(nm, 'дней', X.n, 'эпизодов', X.ind.epn[X.n - 1] + 1, 'vol180 сейчас', X.ind.vol180[X.n - 1].toFixed(0)); }
console.log(H.summary());
// (б) без фильтра возраста, но с выдачей долга и на отскоке самой монеты от минимума эпизода (pmin > x%): монета, развернувшаяся раньше usdt, не остаётся без покупки
if (process.argv[2] === 'own') {
  H.rows.length = 0;
  const Own = (x, A = 0, extra = {}) => { const b = H.Pol2({ k: 0, gate: 'age', A, ...extra }); return { buy: b.buy, release: (ctx) => (ctx.X.ind.pmin[ctx.j] > x ? 1 : b.release(ctx)) }; };
  for (const x of [5, 10, 15, 20, 30]) for (const A of [0, 540]) H.run(`отскок монеты > ${x}% возраст > ${A}`, Own(x, A));
  console.log(H.summary());
}
