/* c7, круг 10: итоговый кандидат c7-best — сравнение с combo7 и combo6, монеты пользователя, правила для маржи (scratchpad/c7/margin_rules.json → python3 c7_margin.py),
   разворот множителя-политики обратно в список правил (копии) и проверка равенства. Запуск: node c7_r10.js (лог scratchpad/c7/r10.txt, данные r10.json) */
const fs = require('fs');
const C = require('./c7_lib.js'), { O, L, P, c } = C;
C.tee('r10');
const G_ON = process.env.C7_G === '1'; // К4 на вершину — отвергнута в круге 9 (вся прибавка — окно 2023–24); включить: C7_G=1
// добавки к combo7 (множитель-политика)
const KDE = (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'euph' && I.isbig[j] < 0.5 && I.op_dvp[j] < 0.3 ? C.sellAct(a, 2) : a; };
const GT = (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'top' && I.au_r30[j] > 3 && I.isbig[j] < 0.5 ? C.sellAct(a, 2) : a; };
const both = (...fs) => (ctx, f, a) => fs.reduce((x, g) => g(ctx, f, x), a);
const polB = C.polM2({ extra: G_ON ? both(KDE, GT) : KDE });
// разворот в копии: перед каждым правилом семьи — копия с условиями слоя и долей × m (как op_r10 / au)
const isF = (fam) => (r) => C.fam7(r) === fam;
let SX = C.O.preMod(isF('euph'), (r) => ({ act: C.sellAct(r.act, 2), conds: [...r.conds, c('op_dvp', '<', 0.3), c('isbig', '<', 0.5)], c7: { family: 'К-D на эйфорию: перцентиль DVOL < 0,3 и не крупная → эйфория ×2', act_was: r.act } }), C.S7);
if (G_ON) SX = C.O.preMod(isF('top'), (r) => ({ act: C.sellAct(r.act, 2), conds: [...r.conds, c('au_r30', '>', 3), c('isbig', '<', 0.5)], c7: { family: 'К4 на вершину: золото +3% за 30 дн и не крупная → широкая тихая вершина ×2', act_was: r.act } }), SX);
console.log(`кандидат: ${G_ON ? 'combo7 + К-D на эйфорию + К4 на вершину' : 'combo7 + К-D на эйфорию'}; список правил: ${SX.rules.length} (combo7 ${C.S7.rules.length}); мини: ${C.mini.rules.length} + множитель`);
// равенство форм
let mx = 0; for (const g of ['sel', 'ex', 'rnd', 'n100', 'mine']) for (const X of L.G[g]) for (const lag of [0, 1]) { const a = P.edge(X, SX, lag, 'full', false, C.polW).e, b = P.edge(X, C.mini, lag, 'full', false, polB).e; mx = Math.max(mx, Math.abs(Math.log1p(a / 100) - Math.log1p(b / 100))); }
console.log('наибольшее расхождение итога монеты (список правил против мини + множитель):', mx.toExponential(2));
const res = {};
O.base('c6'); console.log('к combo6:');
res.c6_c7 = C.run('combo7', C.S7); res.c6_x = C.run('c7-best', SX);
O.base('c7'); console.log('к combo7:');
res.c7_x = C.run('c7-best', SX);
res.c7_mini = C.run('c7-best как мини 23 + множитель', C.mini, polB);
// монеты пользователя
const mine = C.MINE.map((nm) => { const X = C.BY[nm]; if (!X) return { nm, miss: 1 }; return { nm, c6: C.E(X, C.S6, C.polW), c7: C.E(X, C.S7, C.polW), x: C.E(X, SX, C.polW) }; });
console.log('\nмонеты пользователя, итог к DCA %, вся история (худший из сдвигов 0/1): combo6 / combo7 / c7-best (лог к combo7)');
console.log('  ' + mine.map((r) => (r.miss ? `${r.nm}: нет` : `${r.nm} ${Math.round(r.c6)}/${Math.round(r.c7)}/${Math.round(r.x)} (${C.sg(C.L1(r.x) - C.L1(r.c7))})`)).join(', '));
const from = '2026-01-01', A = O.A;
const m26 = C.MINE.map((nm) => { const X = C.BY[nm]; if (!X || X.ind.t[X.n - 1] < C.T(from) + 30) return `${nm}: —`; const Y = A.cut(X, from); return `${nm} ${Math.round(A.E(Y, C.S6, C.polW))}/${Math.round(A.E(Y, C.S7, C.polW))}/${Math.round(A.E(Y, SX, C.polW))}`; });
console.log(`с ${from} с нуля (combo6 / combo7 / c7-best): ${m26.join(', ')}`);
// сейчас: условия добавок на последний день
const d = C.T('2026-11-23') - O.T0; console.log(`\nсейчас (2026-11-23): перцентиль DVOL за год ${(+O.M.op_dvp[d]).toFixed(2)} (К-D на эйфорию — нужно < 0,3); золото за 30 дн ${(+C.O.A.CAL.au_r30[C.T('2026-11-23') - C.O.A.T0]).toFixed(1)}% (К4 на вершину — нужно > 3)`);
const strip = (S) => S.rules.map(({ act, conds }) => ({ act, conds }));
fs.writeFileSync(C.LOG + 'margin_rules.json', JSON.stringify({ combo6: strip(C.S6), combo7: strip(C.S7), 'c7-best': strip(SX) }));
const pack = (r) => ({ medians: C.G3.map((g) => Math.round(r.RS[g].all.med)).join('/'), income: +r.dseg.all.toFixed(3), big: +r.dseg.big.toFixed(3), alt: +r.dseg.alt.toFixed(3), meme: +r.dseg.meme.toFixed(3), strict: r.w ? '✗ ' + r.w : '✔', new100: r.n100 ? `${r.n100.m >= 0 ? '+' : ''}${r.n100.m.toFixed(3)} (${r.n100.u} лучше / ${r.n100.d} хуже)` : '', halves: `${r.hv.h1.toFixed(3)} / ${r.hv.h2.toFixed(3)}`, m81: `${r.m81.m.toFixed(4)} ${r.m81.u}/${r.m81.d}` });
fs.writeFileSync(C.LOG + 'r10.json', JSON.stringify({ G_ON, res: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, pack(r)])), mine, m26, maxdiff: mx, insert: SX.rules.map((r, i) => (r.c7 ? { index0: i, ...r.c7, act: r.act, conds: r.conds } : null)).filter(Boolean), rules: strip(SX), mini: C.mini.rules }));
