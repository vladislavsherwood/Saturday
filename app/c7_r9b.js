/* c7, круг 9 (продолжение): плато и «без эпизода» для двух прошедших добавок поверх B: (Г) золото +3% → вершина ×1,5 у не крупных (К4 на вершину);
   (V) VVIX > 120 → покупки ×1,25 у монет старше года (К-V на покупки). Сравнение к B. Запуск: node c7_r9b.js (лог scratchpad/c7/r9b.txt) */
const C = require('./c7_lib.js'), { P } = C;
C.tee('r9b');
const KDE = (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'euph' && I.isbig[j] < 0.5 && I.op_dvp[j] < 0.3 ? C.sellAct(a, 2) : a; };
const GT = (t = 3, m = 1.5, win) => (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'top' && I.au_r30[j] > t && I.isbig[j] < 0.5 && (!win || I.c7_out[j]) ? C.sellAct(a, m) : a; };
const VB = (t = 120, m = 1.25, A = 365, win) => (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'buy' && I.op_vvix[j] > t && I.age[j] > A && (!win || I.c7_out[j]) ? C.buyAct(a, m) : a; };
const both = (...fs) => (ctx, f, a) => fs.reduce((x, g) => g(ctx, f, x), a);
P.setBaseline(C.mini, C.polM2({ extra: KDE }));
console.log('--- (Г) золото → вершина: порог × множитель (к B) ---');
for (const t of [2, 3, 4, 5]) for (const m of [1.25, 1.5, 2]) C.run(`Г: au_r30 > ${t} → вершина ×${m}`, C.mini, C.polM2({ extra: both(KDE, GT(t, m)) }));
console.log('--- (V) VVIX → покупки: порог × множитель × возраст (к B) ---');
for (const t of [110, 120, 130]) for (const m of [1.25, 1.5]) C.run(`V: VVIX > ${t} → покупки ×${m} (age > 365)`, C.mini, C.polM2({ extra: both(KDE, VB(t, m)) }));
C.run('V: VVIX > 120 → покупки ×1,25 (age > 180)', C.mini, C.polM2({ extra: both(KDE, VB(120, 1.25, 180)) }));
C.run('V: VVIX > 120 → покупки ×1,25 (любой возраст)', C.mini, C.polM2({ extra: both(KDE, VB(120, 1.25, -1)) }));
console.log('--- без эпизода (к B; добавка выключена в окне) ---');
for (const [ep, [a, b]] of Object.entries({ ...C.EPS, '2025-04': ['2025-03-20', '2025-05-15'], '2023-24': ['2023-01-01', '2024-12-31'] })) { C.setWindow(a, b);
  C.run(`без ${ep}: Г`, C.mini, C.polM2({ extra: both(KDE, GT(3, 1.5, 1)) })); C.run(`без ${ep}: V`, C.mini, C.polM2({ extra: both(KDE, VB(120, 1.25, 365, 1)) })); }
C.setWindow('1900-01-01', '1900-01-02');
console.log('--- вместе (к B) ---');
C.run('B + Г + V', C.mini, C.polM2({ extra: both(KDE, GT(), VB()) }));
