/* r4, круг 6: узкий порог «сильной паники» (usdt > 1,2 не откладывается; 1,25 и 1,3 — ✗) — сгладить ступень.
   Гипотеза: ступень «usdt ≤ 1,2 — откладывать всё, > 1,2 — покупать всё сразу» хрупкая; линейный переход (доля «сразу» растёт от 0 при usdt = lo до 1 при usdt = hi)
   даст не меньший доход и меньшую чувствительность к порогу. Плюс: надбавка к долгу растёт с силой паники (m от пика usdt в эпизоде).
   Критерий (заранее): строгая ✔ везде, доход ≥ 0; сдвиг центра перехода ±0,05 теряет меньше, чем сдвиг ступени (1,15 / 1,25). Запуск: node r4_r6.js */
const L = require('./r4_lib.js'), { S0, P2, P } = L;
const Boost = P2.Boost;
// ступень: чувствительность
console.log('— ступень su —');
for (const su of [1.1, 1.15, 1.18, 1.2, 1.22, 1.25, 1.3, 1.4]) L.run(`su ${su}`, S0, Boost(2, { k: 0, A: 0, su }));
// линейный переход: доля «сразу» = clamp((usdt − lo) / (hi − lo), 0, 1); остальное — в долг (если usdt у 10-дн. максимума), выдача × m на развороте
function Ramp(lo, hi, m = 2, o = {}) {
  const t = 0.98, rv = 0.965;
  const base = Boost(m, { k: 0, A: 0, su: 99, ...o }); // su 99 — ступени нет, сразу-долю считаю сам
  return {
    buy: ({ X, j, share }) => { const I = X.ind, u = I.usdt[j]; if (!(I.upk10[j] >= t)) return share; const f = Math.min(1, Math.max(0, (u - lo) / (hi - lo))); return share * f; },
    release: base.release, extra: base.extra,
  };
}
console.log('— линейный переход lo…hi —');
const res = [];
for (const [lo, hi] of [[1.1, 1.3], [1.15, 1.25], [1.15, 1.3], [1.12, 1.28], [1.07, 1.33], [1.18, 1.22], [1.1, 1.2], [1.2, 1.3], [1.2, 1.4], [1.05, 1.25], [1.15, 1.35]]) res.push(L.run(`переход ${lo}…${hi}`, S0, Ramp(lo, hi)));
// надбавка от силы паники: m = 1 + (пик usdt эпизода − 1,07) / d, в пределах [1, mx]
function BoostPk(d, mx) {
  const b = P2.Pol2({ k: 0, A: 0 });
  return { buy: b.buy, release: (ctx) => { const k = b.release(ctx); if (k > 0 && !ctx.X.ind.pend[ctx.j]) ctx.st.rl = k * ctx.st.owed; return k; }, extra: ({ X, j, before, st }) => { if (!st.rl) return 0; const I = X.ind, pk = I.usdt[j] / I.pupk[j]; const m = Math.min(mx, Math.max(1, 1 + (pk - 1.07) / d)); const e = ((m - 1) * st.rl) / Math.max(before, 1e-9); st.rl = 0; return e; } };
}
console.log('— надбавка от пика usdt эпизода: m = 1 + (пик − 1,07) / d, не больше mx —');
for (const [d, mx] of [[0.05, 3], [0.08, 3], [0.1, 3], [0.13, 3], [0.2, 3], [0.05, 4], [0.1, 2], [0.03, 2.5]]) L.run(`d ${d} mx ${mx}`, S0, BoostPk(d, mx));
console.log('— постоянная надбавка (для сравнения) —'); for (const m of [1.5, 2.5, 3]) L.run(`m ${m}`, S0, Boost(m, { k: 0, A: 0 }));
module.exports = { Ramp, BoostPk };
