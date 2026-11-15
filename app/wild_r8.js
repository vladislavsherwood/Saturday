/* Круг 8. «Фрактальная паника»: сигнал паники в стейблах на нескольких масштабах.
   usdt ≈ USDT.D / средняя 200 дн. (сверено: расхождение ≤ 0,03). Строю uN = usdtd / средняя N дн. (N = 50, 100, 400; только прошлое, ≥ N/2 значений),
   nsc — сколько масштабов из 4 (50/100/200/400) «в панике» (uN > 1,07). Использование: require('./wild_r8.js') добавляет индикаторы в W.G. */
const W = require('./wild_sim.js');
for (const g in W.G) for (const X of W.G[g]) {
  const I = X.ind, n = X.n, d = I.usdtd;
  for (const N of [50, 100, 400]) { const a = new Float64Array(n).fill(NaN); let s = 0, c = 0; const q = []; for (let i = 0; i < n; i++) { const v = d[i]; q.push(v); if (isFinite(v)) { s += v; c++; } if (q.length > N) { const o = q.shift(); if (isFinite(o)) { s -= o; c--; } } if (c >= N / 2 && isFinite(v)) a[i] = v / (s / c); } I['u' + N] = a; }
  const ns = new Float64Array(n); for (let i = 0; i < n; i++) ns[i] = (I.u50[i] > 1.07) + (I.u100[i] > 1.07) + (I.usdt[i] > 1.07) + (I.u400[i] > 1.07); I.nsc = ns;
}
module.exports = W;
if (require.main === module) {
  W.report('combo4');
  // (b) паника на другом масштабе, когда 200-дн. паники нет (правило после охраны; правила паники 200 выше по списку)
  const ins = (rule) => { const S = W.clone(W.BASE); S.rules.splice(10, 0, rule); return S; };
  for (const N of [50, 100, 400]) for (const th of [1.07, 1.12]) for (const y of [0.1, 0.25]) W.report(`(b) u${N}>${th} & othd<25 → ${y * 100}%`, ins({ act: 1 + y, conds: [{ ind: 'u' + N, op: '>', v: th }, { ind: 'othd', op: '<', v: 25 }] }));
  // (c) надбавка выдачи долга паники зависит от числа масштабов в панике накануне: m = m0 + k·(nsc − 2), не меньше 1
  const BoostN = (m0, k) => { const b = W.H2.Pol2({ k: 0 }); return { buy: b.buy, release: (ctx) => { const r = b.release(ctx); if (r > 0 && !ctx.X.ind.pend[ctx.j]) { ctx.st.rl = r * ctx.st.owed; ctx.st.mm = Math.max(1, m0 + k * (ctx.X.ind.nsc[ctx.j] - 2)); } return r; }, extra: ({ before, st }) => { if (!st.rl) return 0; const e = ((st.mm - 1) * st.rl) / Math.max(before, 1e-9); st.rl = 0; return e; } }; };
  for (const k of [-0.5, 0.5, 1]) W.report(`(c) выдача ×(2 + ${k}·(nsc−2))`, W.BASE, BoostN(2, k));
  // (a) доли правил паники × g при nsc ≤ 2 (паника не на всех масштабах) или × g при nsc = 4
  const hkA = (cond, g) => ({ act: ({ X, j, q, a, R }) => (q >= 0 && R[q].p && a > 1 && cond(X.ind.nsc[j]) ? 1 + (a - 1) * g : a) });
  for (const g of [1.5, 0.75]) { W.report(`(a) паника ×${g} при nsc≤2`, W.BASE, W.POL, hkA((v) => v <= 2, g)); W.report(`(a) паника ×${g} при nsc=4`, W.BASE, W.POL, hkA((v) => v === 4, g)); }
  console.log(W.summary());
}
