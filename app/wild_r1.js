/* Круг 1. Зеркальная отложенная продажа: «копить продажу, пока монета растёт, продать на развороте вниз».
   Если накануне правило продажи класса cl сработало, а монета у своего 10-дн. максимума (ck10 = close / max close 10 дн ≥ t) —
   не продавать, а записать долю в «долг продажи» (доля монеты, сложение 1 − (1 − d)(1 − x)). Когда накануне ck10 < rv —
   продать долг × m (не больше 100%), долг обнулить. Долг старше N дней: 'sell' — продать как есть, 'drop' — забыть.
   Запуск: node wild_r1.js > scratchpad/wild/r1.log */
const W = require('./wild_sim.js');
for (const g in W.G) for (const X of W.G[g]) { const c = X.c, n = X.n, a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (c[k] > m) m = c[k]; a[i] = c[i] / m; } X.ind.ck10 = a; }
const CL = { top: ['qt', 'wide', 'pump', 'as', 'fund'], fear: ['fear40', 'fear52'], all: ['qt', 'wide', 'pump', 'as', 'fund', 'fear40', 'fear52'], wide: ['qt', 'wide'] };
function hk({ cl, t, rv, m = 1, N = 30, ex = 'sell' }) {
  const set = CL[cl];
  return {
    init: () => ({ d: 0, t0: -1 }),
    act: ({ X, j, q, a, R, s }) => {
      const ck = X.ind.ck10[j];
      if (q >= 0 && a < 0 && set.includes(W.cls(R[q].r)) && ck >= t) { s.d = 1 - (1 - s.d) * (1 + a); if (s.t0 < 0) s.t0 = j; return 0; }
      if (s.d > 0) {
        if (ck < rv && !(a > 1)) { const x = Math.min(1, s.d * m); s.d = 0; s.t0 = -1; return a < 0 ? -(1 - (1 - x) * (1 + a)) : -x; }
        if (j - s.t0 > N) { const x = s.d; s.d = 0; s.t0 = -1; if (ex === 'sell' && !(a > 1)) return a < 0 ? -(1 - (1 - x) * (1 + a)) : -x; }
      }
      return a;
    },
  };
}
if (process.argv[2] !== "anti") {
W.report("combo4");
for (const cl of ['top', 'wide', 'fear', 'all'])
  for (const t of [0.97, 0.99])
    for (const rv of [0.9, 0.95])
      for (const m of [1, 1.5]) W.report(`${cl} t${t} rv${rv} m${m}`, W.BASE, W.POL, hk({ cl, t, rv, m }));
for (const N of [10, 60]) for (const ex of ['sell', 'drop']) W.report(`top t0.99 rv0.95 m1 N${N} ${ex}`, W.BASE, W.POL, hk({ cl: 'top', t: 0.99, rv: 0.95, N, ex }));
console.log(W.summary());
}
// антипод: продавать больше, когда монета у 10-дн. максимума (на силе), × g
if (process.argv[2] === 'anti') {
  const anti = (cl, t, g) => ({ act: ({ X, j, q, a, R }) => (q >= 0 && a < 0 && CL[cl].includes(W.cls(R[q].r)) && X.ind.ck10[j] >= t ? Math.max(-1, a * g) : a) });
  for (const cl of ['top', 'fear', 'all']) for (const t of [0.97, 0.99]) for (const g of [1.25, 1.5]) W.report(`АНТИ ${cl} t${t} ×${g}`, W.BASE, W.POL, anti(cl, t, g));
  // и обратное: на силе продавать меньше (× g < 1)
  for (const cl of ['top', 'fear']) W.report(`АНТИ ${cl} t0.99 ×0.75`, W.BASE, W.POL, anti(cl, 0.99, 0.75));
}
