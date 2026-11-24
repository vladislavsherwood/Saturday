/* c7, круг 3 (продолжение): два прохода сетки круга 3 — (1) К-D на эйфорию (перцентиль DVOL < 0,3 → эйфория ×1,5) и (2) К1 на фандинг (серебро хуже золота → фандинг копить).
   Плато (порог, множитель), контроль без условия, рядом: ставки > +0,5 → эйфория ×1,5. Запуск: node c7_r3b.js (лог scratchpad/c7/r3b.txt) */
const C = require('./c7_lib.js');
C.tee('r3b');
const E = (pred, m) => C.polM2({ extra: (ctx, f, a) => (f === 'euph' && pred(ctx.X.ind, ctx.j) ? C.sellAct(a, m) : a) });
console.log('--- эйфория ×m без условия (контроль) ---');
for (const m of [1.25, 1.5, 2]) C.run(`эйфория ×${m} всегда`, C.mini, E(() => true, m));
console.log('--- К-D → эйфория: перцентиль DVOL < t, ×m ---');
for (const t of [0.2, 0.3, 0.4, 0.5]) for (const m of [1.25, 1.5, 2]) C.run(`DVOL перц. < ${t} → эйфория ×${m}`, C.mini, E((I, j) => I.op_dvp[j] < t, m));
console.log('--- ставки → эйфория ---');
for (const t of [0.3, 0.5, 0.7]) C.run(`ставка 90д > +${t} → эйфория ×1.5`, C.mini, E((I, j) => I.c7_tnx90[j] > t, 1.5));
console.log('--- К1 → фандинг копить: серебро хуже золота на X п.п. (возраст > 365 / без) ---');
const F = (pred) => C.polM2({ extra: (ctx, f, a) => (f === 'fund' && pred(ctx.X.ind, ctx.j) ? 1e-6 : a) });
for (const X of [-4, -6, -8]) { C.run(`agau30 < ${X}, age > 365 → фандинг копить`, C.mini, F((I, j) => I.agau30[j] < X && I.age[j] > 365)); C.run(`agau30 < ${X} → фандинг копить`, C.mini, F((I, j) => I.agau30[j] < X)); }
