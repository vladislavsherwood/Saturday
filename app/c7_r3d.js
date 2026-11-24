/* c7, круг 3 (контроль находки): эйфория ×m у не крупных без условия DVOL; К-D → эйфория ×4/×5 (где кончается плато); с учётом hv2 — потолок суммарного множителя.
   Запуск: node c7_r3d.js (лог scratchpad/c7/r3d.txt) */
const C = require('./c7_lib.js');
C.tee('r3d');
const E = (pred, m, cap) => C.polM2({ extra: (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; if (f !== 'euph' || I.isbig[j] > 0.5 || !pred(I, j)) return a; let b = C.sellAct(a, m); if (cap) b = Math.max(b, -cap); return b; } });
for (const m of [1.5, 2, 3]) C.run(`не крупные: эйфория ×${m} всегда`, C.mini, E(() => true, m));
for (const m of [4, 5]) C.run(`не крупные: DVOL < 0,3 → эйфория ×${m}`, C.mini, E((I, j) => I.op_dvp[j] < 0.3, m));
for (const cap of [0.1, 0.2]) C.run(`не крупные: DVOL < 0,3 → эйфория ×2, не больше ${cap * 100}% в день`, C.mini, E((I, j) => I.op_dvp[j] < 0.3, 2, cap));
// DVOL высокая (перцентиль > 0,7) → эйфория ×0,5 (зеркало)
C.run('не крупные: DVOL > 0,7 → эйфория ×0,5', C.mini, E((I, j) => I.op_dvp[j] > 0.7, 0.5));
