/* hv, круг 7: сочетание находок кругов 2 и 4 — у волатильной монеты (hvv > T, не крупная) продажи у вершины крупнее:
   памп в медвежьем рынке (53–55) уже от up90 > U и × m; широкая тихая вершина (40–51) × m; эйфория (57–58) × m; [альтсезон (56) × m]. Плато по T, U, m, порогу BTC ниже ATH. */
const H = require('./hv_lib.js'), { c } = H;
const NB = [c('isbig', '<', 0.5)];
const PB = (r, k) => k >= 52 && k <= 54, WIDE = (r, k) => k >= 39 && k <= 50, EU = (r, k) => k === 56 || k === 57, AS = (r, k) => k === 55;
const mPump = (T, U, m, B = 20) => (r) => { for (const x of r.conds) { if (x.ind === 'up90') x.v = U; if (x.ind === 'btcath') x.v = B; } r.conds.push(...H.HV(T), ...NB); r.act = H.mul(m)(r.act); return r; };
const mSell = (T, m) => (r) => { r.conds.push(...H.HV(T), ...NB); r.act = H.mul(m)(r.act); return r; };
// единая сборка: o = { T, U, mp, mw, me, ma, B } (m = 1 — семья не меняется). Копии ставятся по исходным индексам (сначала с конца списка, чтобы индексы не съезжали).
function build(o, S0 = H.S5) {
  const { T = 115, U = 150, mp = 1.5, mw = 1.5, me = 1.5, ma = 1, B = 20 } = o;
  let S = S0;
  if (me !== 1) S = H.preMod(S, EU, mSell(T, me));
  if (ma !== 1) S = H.preMod(S, AS, mSell(T, ma));
  if (mp !== 1 || U !== 300 || B !== 20) S = H.preMod(S, PB, mPump(T, U, mp, B));
  if (mw !== 1) S = H.preMod(S, WIDE, mSell(T, mw));
  return S;
}
module.exports = { build };
if (require.main === module) {
  H.head();
  H.ev('combo5', H.S5);
  H.ev('памп 150 ×1,5', build({ mw: 1, me: 1 }));
  H.ev('+ широкая ×1,5', build({ me: 1 }));
  H.ev('+ эйфория ×1,5 (П+Ш+Э)', build({}));
  H.ev('+ альтсезон ×1,5', build({ ma: 1.5 }));
  H.ev('П+Ш+Э ×2', build({ mp: 2, mw: 2, me: 2 }));
  H.ev('П+Ш+Э ×1,25', build({ mp: 1.25, mw: 1.25, me: 1.25 }));
  H.ev('П 200 ×1,5 + Ш + Э', build({ U: 200 }));
  H.ev('П 250 ×1,5 + Ш + Э', build({ U: 250 }));
  H.ev('П 100 ×1,5 + Ш + Э', build({ U: 100 }));
  H.ev('Ш + Э (без пампа)', build({ mp: 1, U: 300 }));
  for (const T of [100, 130]) H.ev(`T${T} П+Ш+Э ×1,5`, build({ T }));
  for (const T of [105, 125]) H.ev(`T${T} П+Ш+Э ×1,5`, build({ T }));
  for (const B of [15, 25, 30]) H.ev(`П+Ш+Э, BTC ниже ATH > ${B}`, build({ B }));
}
