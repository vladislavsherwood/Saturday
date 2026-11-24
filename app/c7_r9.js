/* c7, круг 9: сборка. Основа круга — B = combo7 + «К-D на эйфорию» (не крупные, перцентиль DVOL < 0,3 → эйфория ×2), сравнение к B и к combo7.
   Поверх B — близкие промахи круга 3 в осторожной форме (возраст > 365 / не крупные, ×1,25): DVOL → страх, золото → вершина, VVIX → покупки, ставки → эйфория,
   эйфория ×1,5 всегда. Запуск: node c7_r9.js (лог scratchpad/c7/r9.txt) */
const C = require('./c7_lib.js'), { P } = C;
C.tee('r9');
const KDE = (m = 2, t = 0.3) => (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'euph' && I.isbig[j] < 0.5 && I.op_dvp[j] < t ? C.sellAct(a, m) : a; };
const both = (...fs) => (ctx, f, a) => fs.reduce((x, g) => g(ctx, f, x), a);
const B = C.polM2({ extra: KDE() });
const ADD = {
  'DVOL < 0,3 → страх ×1,25 (возраст > 365)': (ctx, f, a) => (f === 'fear' && ctx.X.ind.op_dvp[ctx.j] < 0.3 && ctx.X.ind.age[ctx.j] > 365 ? C.sellAct(a, 1.25) : a),
  'DVOL < 0,3 → страх ×1,5 (возраст > 365)': (ctx, f, a) => (f === 'fear' && ctx.X.ind.op_dvp[ctx.j] < 0.3 && ctx.X.ind.age[ctx.j] > 365 ? C.sellAct(a, 1.5) : a),
  'золото +3% → вершина ×1,5 (не крупные)': (ctx, f, a) => (f === 'top' && ctx.X.ind.au_r30[ctx.j] > 3 && ctx.X.ind.isbig[ctx.j] < 0.5 ? C.sellAct(a, 1.5) : a),
  'золото +3% → вершина ×1,25': (ctx, f, a) => (f === 'top' && ctx.X.ind.au_r30[ctx.j] > 3 ? C.sellAct(a, 1.25) : a),
  'VVIX > 120 → покупки ×1,25 (возраст > 365)': (ctx, f, a) => (f === 'buy' && ctx.X.ind.op_vvix[ctx.j] > 120 && ctx.X.ind.age[ctx.j] > 365 ? C.buyAct(a, 1.25) : a),
  'ставка 90д > +0,5 → эйфория ×1,5 (не крупные)': (ctx, f, a) => (f === 'euph' && ctx.X.ind.c7_tnx90[ctx.j] > 0.5 && ctx.X.ind.isbig[ctx.j] < 0.5 ? C.sellAct(a, 1.5) : a),
  'эйфория ×1,5 всегда (не крупные)': (ctx, f, a) => (f === 'euph' && ctx.X.ind.isbig[ctx.j] < 0.5 ? C.sellAct(a, 1.5) : a),
};
console.log('=== к combo7 ===');
C.run('B: К-D → эйфория ×2', C.mini, B);
C.run('B′: эйфория ×2 всегда (не крупные), без DVOL', C.mini, C.polM2({ extra: (ctx, f, a) => (f === 'euph' && ctx.X.ind.isbig[ctx.j] < 0.5 ? C.sellAct(a, 2) : a) }));
P.setBaseline(C.mini, B);
console.log('=== к B ===');
for (const [nm, g] of Object.entries(ADD)) C.run('B + ' + nm, C.mini, C.polM2({ extra: both(KDE(), g) }));
