/* Круг 3. «Усталость тренда»: доля продажи растёт с длительностью эпизода продаж.
   Эпизод класса — дни, когда сработало правило продажи этого класса, с разрывами ≤ GAP дней; d — день эпизода (0 — первый).
   Множитель доли: lo + (hi − lo) × min(1, d / D)  (lo — в начале эпизода, hi — после D дней). Итог доли ≤ 100%.
   Классы: страх (fear40 + fear52), вершины (qt + wide + pump + as + fund), все. Запуск: node wild_r3.js > scratchpad/wild/r3.log */
const W = require('./wild_sim.js');
const CL = { fear: ['fear40', 'fear52'], top: ['qt', 'wide', 'pump', 'as', 'fund'], all: ['fear40', 'fear52', 'qt', 'wide', 'pump', 'as', 'fund'] };
function hk({ cl, lo = 1, hi, D, GAP = 10 }) {
  const set = CL[cl];
  return {
    init: () => ({ e0: -1e9, last: -1e9 }),
    act: ({ j, q, a, R, s }) => {
      if (!(q >= 0 && a < 0 && set.includes(W.cls(R[q].r)))) return a;
      if (j - s.last > GAP) s.e0 = j; s.last = j;
      const d = j - s.e0, k = lo + (hi - lo) * Math.min(1, d / D);
      return Math.max(-1, a * k);
    },
  };
}
W.report('combo4');
const arg = process.argv[2] || 'grid';
if (arg === 'grid') {
  for (const cl of ['fear', 'top', 'all']) for (const D of [30, 90, 180]) for (const hi of [1.5, 2]) W.report(`${cl} D${D} 1→${hi}`, W.BASE, W.POL, hk({ cl, hi, D }));
  // со срезом начала эпизода (lo < 1): «в начале меньше, в конце больше» при той же средней
  for (const cl of ['fear', 'all']) for (const D of [90]) W.report(`${cl} D${D} 0.75→1.5`, W.BASE, W.POL, hk({ cl, lo: 0.75, hi: 1.5, D }));
}
console.log(W.summary());
if (arg === 'ctl') { // контроль: те же продажи × g всегда (без времени) — отличается ли «усталость» от «продавать больше»?
  for (const cl of ['fear', 'top', 'all']) for (const g of [1.15, 1.3]) W.report(`КОНТРОЛЬ ${cl} ×${g} всегда`, W.BASE, W.POL, hk({ cl, lo: g, hi: g, D: 1 }));
  // альты без мемов: усталость только у альтов и крупных
  const hkNoMeme = (o) => { const h = hk(o); return { init: h.init, act: (c) => (c.X.seg === 'meme' ? c.a : h.act(c)) }; };
  for (const [cl, D, hi] of [['top', 30, 1.5], ['all', 30, 1.5], ['fear', 30, 1.5], ['all', 90, 1.5]]) W.report(`без мемов ${cl} D${D} 1→${hi}`, W.BASE, W.POL, hkNoMeme({ cl, hi, D }));
}
