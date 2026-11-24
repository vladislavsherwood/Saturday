/* c7, круг 6: доллар и ставки как режим‑множитель долей (st нашёл сильный прогноз: DXY ±4% за 90 дн → +26 / −21% за 90 дн у монет, ставка 10л ±0,5 п.п.;
   st круг 6 отверг поправки к отдельным правилам; круг 3 c7 — по одной семье). Здесь — режим на все продажи / все покупки сразу и на фитили.
   Запуск: node c7_r6.js (лог scratchpad/c7/r6.txt) */
const C = require('./c7_lib.js');
C.tee('r6');
const SELL = ['fear', 'qt', 'top', 'pump', 'euph', 'alt', 'fund'], BUY = ['buy', 'rev', 'b60'];
// up(I,j) — «доллар/ставки растут» (плохо для крипты), dn — «падают»
const REG = {
  'DXY 90д ±3%': [(I, j) => I.c7_dxy90[j] > 3, (I, j) => I.c7_dxy90[j] < -3],
  'DXY 90д ±4%': [(I, j) => I.c7_dxy90[j] > 4, (I, j) => I.c7_dxy90[j] < -4],
  'DXY 30д ±2%': [(I, j) => I.c7_dxy30[j] > 2, (I, j) => I.c7_dxy30[j] < -2],
  'DXY к SMA200 ±2%': [(I, j) => I.c7_dxy200[j] > 1.02, (I, j) => I.c7_dxy200[j] < 0.98],
  'ставка 90д ±0,5': [(I, j) => I.c7_tnx90[j] > 0.5, (I, j) => I.c7_tnx90[j] < -0.5],
  'DXY 90д > 3 и ставка > 0,3 / < −3 и < −0,3': [(I, j) => I.c7_dxy90[j] > 3 && I.c7_tnx90[j] > 0.3, (I, j) => I.c7_dxy90[j] < -3 && I.c7_tnx90[j] < -0.3],
};
const mk = (up, dn, ms, mb, side) => C.polM2({ extra: (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j;
  if (a < 0 && SELL.includes(f)) { if (side !== 'b' && up(I, j)) return C.sellAct(a, ms); if (side === '2' && dn(I, j)) return C.sellAct(a, 1 / ms); }
  if (a > 1 && BUY.includes(f)) { if (side !== 's' && dn(I, j)) return C.buyAct(a, mb); if (side === '2' && up(I, j)) return C.buyAct(a, 1 / mb); }
  return a; } });
for (const [nm, [up, dn]] of Object.entries(REG)) {
  C.run(`${nm}: продажи ×1,25 при росте`, C.mini, mk(up, dn, 1.25, 1, 's'));
  C.run(`${nm}: покупки ×1,25 при падении`, C.mini, mk(up, dn, 1, 1.25, 'b'));
  C.run(`${nm}: оба ×1,25`, C.mini, mk(up, dn, 1.25, 1.25, 'sb'));
  C.run(`${nm}: двусторонне ×1,25 / ×0,8`, C.mini, mk(up, dn, 1.25, 1.25, '2'));
  for (const [mu, md] of [[0.5, 1.5], [1, 1.5], [0.5, 1]]) { const p = C.polM2(); p.wick = { ...p.wick, mult: (X, j) => (up(X.ind, j) ? mu : dn(X.ind, j) ? md : 1) }; C.run(`${nm}: фитили ×${mu} при росте / ×${md} при падении`, C.mini, p); }
}
