/* c7, круг 3: взаимодействие слоёв — общий «режим риска». Условие каждого слоя (и рынка: DXY, ставки, VIX) применяется как множитель к другим семьям.
   Сетка: условие × семья × множитель (×1,5 / ×0,5; фандинг: копить / ×2). Основа — мини 23 + множитель (= combo7). Запуск: node c7_r3.js (лог scratchpad/c7/r3.txt) */
const C = require('./c7_lib.js');
C.tee('r3' + (process.argv[2] || ''));
const CND = {
  'золото +3% (К4)': (I, j) => I.au_r30[j] > 3 && I.age[j] > 365,
  'серебро хуже золота (К1)': (I, j) => I.agau30[j] < -6 && I.age[j] > 365,
  'VVIX > 120 (К-V)': (I, j) => I.op_vvix[j] > 120,
  'DVOL перц. < 0,3 (К-D)': (I, j) => I.op_dvp[j] < 0.3,
  'DXY 90д > +3%': (I, j) => I.c7_dxy90[j] > 3,
  'DXY 90д < −3%': (I, j) => I.c7_dxy90[j] < -3,
  'ставка 90д > +0,5': (I, j) => I.c7_tnx90[j] > 0.5,
  'ставка 90д < −0,5': (I, j) => I.c7_tnx90[j] < -0.5,
  'VIX > 30': (I, j) => I.op_vix[j] > 30,
};
const FAMS = ['buy', 'rev', 'fear', 'qt', 'top', 'pump', 'fund', 'euph'];
const only = process.argv[2] ? process.argv[2].split(',') : null;
const rows = [];
for (const [cn, cf] of Object.entries(CND)) for (const f of FAMS) for (const m of f === 'fund' ? [0, 2] : [1.5, 0.5]) {
  if (only && !only.includes(f)) continue;
  const extra = (ctx, ff, a) => { if (ff !== f || !cf(ctx.X.ind, ctx.j)) return a; if (f === 'fund' && m === 0) return 1e-6; return a > 1 ? C.buyAct(a, m) : a < 0 ? C.sellAct(a, m) : a; };
  const nm = `${cn} → ${f} ${f === 'fund' && m === 0 ? 'копить' : '×' + m}`;
  const r = C.run(nm, C.mini, C.polM2({ extra }), { w: 44 });
  rows.push(r);
}
console.log('\nлучшие по доходу (★ — формальные пункты 1, 2, 4):');
rows.sort((a, b) => b.dseg.all - a.dseg.all).slice(0, 25).forEach((r) => console.log(r.s));
