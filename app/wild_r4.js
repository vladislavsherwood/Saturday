/* Круг 4. «Стратегия смотрит в зеркало»: средняя цена собственной позиции (себестоимость) как сигнал.
   pr = цена накануне / средняя цена купленных монет (продажи не меняют среднюю цену). Варианты:
     A «не продавать в убыток»: продажа (класс cl) отменяется (взнос → в резерв), если pr < 1 + x;
     B «продажа по прибыли»: доля продажи × g, если pr > P (большая прибыль), иначе как есть;
     C «докупка ниже себестоимости»: в дни покупок из резерва (a > 1) доля × m, если pr < 1 − y.
   Запуск: node wild_r4.js > scratchpad/wild/r4.log */
const W = require('./wild_sim.js');
const FEE = 0.001;
const CL = { fear: ['fear40', 'fear52'], top: ['qt', 'wide', 'pump', 'as', 'fund'], all: ['fear40', 'fear52', 'qt', 'wide', 'pump', 'as', 'fund'] };
function track() { return { init: () => ({ u: 0, inv: 0 }), after: ({ s, units, p }) => { const du = units - s.u; if (du > 1e-15) s.inv += (du * p) / (1 - FEE); else if (du < -1e-15 && s.u > 0) s.inv *= units / s.u; s.u = units; } }; }
const pr = (X, j, s) => (s.u > 0 && s.inv > 0 ? X.c[j] / (s.inv / s.u) : NaN);
function hk(mode, o) {
  const T = track();
  return {
    init: T.init, after: T.after,
    act: ({ X, j, q, a, R, s }) => {
      const r = pr(X, j, s); if (!isFinite(r)) return a;
      if (mode === 'A' && a < 0 && CL[o.cl].includes(W.cls(R[q].r)) && r < 1 + o.x) return 0;
      if (mode === 'B' && a < 0 && CL[o.cl].includes(W.cls(R[q].r)) && r > o.P) return Math.max(-1, a * o.g);
      if (mode === 'C' && a > 1 && r < 1 - o.y && !(o.np && R[q].p)) return 1 + (a - 1) * o.m;
      return a;
    },
  };
}
const arg = process.argv[2] || 'grid';
W.report('combo4');
if (arg === 'grid') {
// диагностика: где лежит pr в дни продаж и покупок combo4
{
  const H = { sell: [], buy: [] };
  for (const g of ['sel', 'ex', 'rnd']) for (const X of W.G[g]) { const T = track(), s = T.init(); const h = { init: () => s, after: T.after, act: (c) => { if (c.a < 0) H.sell.push(pr(c.X, c.j, s)); if (c.a > 1) H.buy.push(pr(c.X, c.j, s)); return c.a; } }; W.edge(X, W.BASE, 0, 'full', false, W.POL, h); }
  for (const k in H) { const a = H[k].filter(isFinite).sort((x, y) => x - y); console.log(`pr в дни ${k}: n ${a.length}, квантили 10/25/50/75/90%:`, [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => a[Math.floor(p * a.length)].toFixed(2)).join(' '), `| доля pr<1: ${(100 * a.filter((v) => v < 1).length / a.length).toFixed(0)}%`); }
}
for (const cl of ['fear', 'all']) for (const x of [0, 0.3, 1]) W.report(`A ${cl} не продавать при pr<${1 + x}`, W.BASE, W.POL, hk('A', { cl, x }));
for (const cl of ['top', 'all']) for (const P of [3, 6]) for (const g of [1.25, 1.5]) W.report(`B ${cl} pr>${P} ×${g}`, W.BASE, W.POL, hk('B', { cl, P, g }));
for (const y of [0, 0.3, 0.5]) for (const m of [1.5, 2]) W.report(`C pr<${1 - y} покупки ×${m}`, W.BASE, W.POL, hk('C', { y, m }));
}
if (arg === 'plateau') { // плато C (движок: изменённая доля паники тоже откладывается); np — только покупки не-паники
  for (const np of [false, true]) for (const y of [0.4, 0.5, 0.6]) for (const m of [1.25, 1.5, 2, 3]) W.report(`C${np ? ' без паники' : ''} pr<${(1 - y).toFixed(1)} ×${m}`, W.BASE, W.POL, hk('C', { y, m, np }));
}
console.log(W.summary());
