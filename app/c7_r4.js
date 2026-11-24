/* c7, круг 4: правило фандинга (fund30 > 2 → продать 5%; сегменты ×1,25 / ×2; К-V: VVIX > 120 → копить).
   Диагностика круга 1: без правила 100 новых +0,060 (49/13), альты +0,037, но крупные −0,288, мемы −1,87. Гипотеза: фандинг вредит молодым/волатильным альтам, полезен крупным и мемам.
   Варианты: для части монет правило не срабатывает (условие в правило — день уходит дальше по списку) или копить/взнос; порог фандинга. Запуск: node c7_r4.js (лог scratchpad/c7/r4.txt) */
const C = require('./c7_lib.js'), { L, c } = C;
C.tee('r4');
const FI = C.mini.rules.findIndex((r) => r.f === 'fund');
const withConds = (cs) => { const S = L.clone(C.mini); S.rules[FI].conds.push(...cs); return S; };
const ex = (pred, act) => C.polM2({ extra: (ctx, f, a) => (f === 'fund' && pred(ctx.X.ind, ctx.j) ? act : a) });
console.log('--- условие в правило (не срабатывает → дальше по списку) ---');
C.run('фандинг только не альтам (isalt < 0,5)', withConds([c('isalt', '<', 0.5)]), C.polM2());
for (const A of [180, 365, 540, 730]) C.run(`фандинг только age > ${A}`, withConds([c('age', '>', A)]), C.polM2());
for (const H of [90, 110, 130]) C.run(`фандинг только hvv < ${H} или крупные — hvv < ${H}`, withConds([c('hvv', '<', H)]), C.polM2());
for (const B of [0.5, 0.7, 0.9]) C.run(`фандинг только beta180 > ${B}`, withConds([c('beta180', '>', B)]), C.polM2());
for (const F of [1.5, 2.5, 3, 4]) { const S = L.clone(C.mini); S.rules[FI].conds.find((x) => x.ind === 'fund30').v = F; C.run(`порог fund30 > ${F}`, S, C.polM2()); }
console.log('--- копить / взнос вместо продажи ---');
const P = { 'альты': (I, j) => I.isalt[j] > 0.5, 'age < 365': (I, j) => !(I.age[j] > 365), 'age < 730': (I, j) => !(I.age[j] > 730), 'hvv > 110': (I, j) => I.hvv[j] > 110 && I.isbig[j] < 0.5, 'альты age < 730': (I, j) => I.isalt[j] > 0.5 && !(I.age[j] > 730) };
for (const [nm, pr] of Object.entries(P)) { C.run(`${nm}: копить`, C.mini, ex(pr, 1e-6)); C.run(`${nm}: взнос`, C.mini, ex(pr, 1)); }
