/* Круг 2: «отложенный бюджет» паники. Без подтверждения правило паники тратит долю × k, остаток копится в долге ($);
   при подтверждении (накануне) — полная доля + весь долг; в конце эпизода (10 дней без паники) — долг × endRel (1 — тратится, 0 — остаётся в резерве).
   Подтверждения: RSI BTC < r, BTC ниже старта эпизода > d%, usdt ниже пика эпизода (pupk < u), их ИЛИ. Запуск: node panicx_r2.js */
const P = require('./panicx_sim.js');
const CF = {
  rsi30: (I, j) => I.brsi[j] < 30,
  bd10: (I, j) => I.bdrop[j] > 10,
  pk95: (I, j) => I.pupk[j] < 0.95,
  any: (I, j) => I.brsi[j] < 30 || I.bdrop[j] > 10 || I.pupk[j] < 0.95,
};
const D = (cf, k, endRel) => ({
  buy: ({ X, j, share }) => (cf(X.ind, j) ? share : share * k),
  release: ({ X, j }) => (cf(X.ind, j) ? 1 : X.ind.pend[j] ? endRel : 0),
});
P.report('основа', P.base, null);
for (const cn in CF) for (const k of [0, 0.5]) for (const e of [1, 0]) P.report(`${cn} k${k} end${e}`, P.base, D(CF[cn], k, e));
module.exports = { CF, D };
