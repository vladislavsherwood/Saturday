/* Круг 7. «Отложенный взнос»: механизм отложенной паники для ежедневного взноса (самый большой поток денег).
   В день без сигнала (действие = взнос) взнос не покупается, а копится в «долг взноса», если накануне выполнено условие «падение»:
     src 'coin': монета ниже своего 10-дн. максимума больше чем на x (ck10 < 1 − x);  src 'btc': то же у BTC.
   Долг тратится (весь, в день без продажи) при «отскоке»: монета/BTC выше своего 10-дн. минимума больше чем на y (fl10 > 1 + y), или через N дней.
   Обратный вариант 'dip': копить, пока монета у 10-дн. максимума (ck10 ≥ 1 − x), тратить на откате (ck10 < 1 − y) — «покупать провалы».
   Запуск: node wild_r7.js > scratchpad/wild/r7.log */
const W = require('./wild_sim.js');
const roll = (c, n, f) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = f === 'max' ? -Infinity : Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) m = f === 'max' ? Math.max(m, c[k]) : Math.min(m, c[k]); a[i] = c[i] / m; } return a; };
for (const g in W.G) for (const X of W.G[g]) {
  const I = X.ind; I.ck10 = I.ck10 || roll(X.c, X.n, 'max'); I.fl10 = roll(X.c, X.n, 'min');
  const b = Float64Array.from(I.btcp); for (let i = 1; i < X.n; i++) if (!isFinite(b[i])) b[i] = b[i - 1]; I.bck10 = roll(b, X.n, 'max'); I.bfl10 = roll(b, X.n, 'min');
}
const UNIT = 10;
function hk({ src = 'coin', x = 0.05, y = 0.05, N = 30, mode = 'bounce' }) {
  const ck = src === 'coin' ? 'ck10' : 'bck10', fl = src === 'coin' ? 'fl10' : 'bfl10';
  return {
    init: () => ({ d: 0, t0: -1, rel: 0 }),
    act: ({ X, j, q, a, s }) => {
      const I = X.ind; s.rel = 0;
      const plain = a === 1; // день без сигнала (взнос) или правило «только взнос»
      if (s.d > 0 && plain) { // выдача только в простой день (не в день продажи и не в день покупки паники — та может отложиться)
        const fire = mode === 'bounce' ? I[fl][j] > 1 + y : I[ck][j] < 1 - y;
        if (fire || j - s.t0 > N) { s.rel = s.d; s.d = 0; s.t0 = -1; }
      }
      if (plain && !s.rel) {
        const hold = mode === 'bounce' ? I[ck][j] < 1 - x : I[ck][j] >= 1 - x;
        if (hold) { s.d += UNIT; if (s.t0 < 0) s.t0 = j; return 0; } // взнос остаётся в резерве
      }
      return a;
    },
  };
}
// выдача долга взноса: через extra (доля резерва) — но extra работает только в день без сигнала; поэтому выдаю через act: превращаю день в покупку резерва на сумму долга
function wrap(o) {
  const h = hk(o);
  return {
    init: h.init,
    act: (c) => { const a = h.act(c); if (c.s.rel > 0 && a === 1) { const cash = c.cash; return cash > 0 ? a + Math.min(1, c.s.rel / cash) : a; } return a; },
  };
}
W.report('combo4');
for (const src of ['coin', 'btc']) for (const x of [0.05, 0.1]) for (const y of [0.03, 0.08]) W.report(`отскок ${src} падение>${x} отскок>${y}`, W.BASE, W.POL, wrap({ src, x, y }));
for (const x of [0.02, 0.05]) for (const y of [0.05, 0.1]) W.report(`провалы coin у максимума(${x}) откат>${y}`, W.BASE, W.POL, wrap({ mode: 'dip', x, y }));
console.log(W.summary());
