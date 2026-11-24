/* К4 и цикл: «бегство из крипты в золото» имеет смысл, только когда держателям крипты есть что фиксировать (рынок в прибыли).
   У дна цикла (MVRV BTC < 1 — средний держатель в убытке; или недавно был < 1) рост золота — признак разворота денежной политики (пик доллара/ставок),
   продавцы уже вышли, и продажа на страхе ×1,5 продаёт дно. Проверка: К4 только при MVRV выше порога / без недавнего MVRV < 1; и шире — все продажи на страхе.
   Основа — текущий черновик combo7 (= c7-best: мини 23 + множитель + К-D на эйфорию). Запуск: C7_BASE=combo7-draft.json node k4_fix.js [main|wide|eps] */
const C = require('./c7_lib.js'), { L } = C;
const mode = process.argv[2] || 'main';
C.tee('k4_fix_' + mode);
C.O.base('c7');
const KDE = (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'euph' && I.isbig[j] < 0.5 && I.op_dvp[j] < 0.3 ? C.sellAct(a, 2) : a; };
// min MVRV за N прошлых дней (рынок, на днях монеты)
for (const N of [90, 365]) L.addInd('k4_mvmin' + N, (X) => { const v = X.ind.mvrv, o = new Float64Array(X.n).fill(NaN); for (let i = 0; i < X.n; i++) { let m = Infinity; for (let k = Math.max(0, i - N + 1); k <= i; k++) if (isFinite(v[k]) && v[k] < m) m = v[k]; o[i] = m === Infinity ? NaN : m; } return o; });
const K4 = (pred, extra) => C.polM2({ k4: 0, extra: (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; let b = KDE(ctx, f, a);
  if (f === 'fear' && I.au_r30[j] > 3 && I.age[j] > 365 && pred(I, j)) b = C.sellAct(b, 1.5);
  return extra ? extra(ctx, f, b) : b; } });
const mv = (I, j) => (isFinite(I.mvrv[j]) ? I.mvrv[j] : 9);
if (mode === 'main') {
  C.run('контроль: К4 как есть (= черновик)', C.mini, K4(() => true));
  for (const v of [0.9, 1, 1.1, 1.2, 1.3]) C.run(`К4 только при MVRV > ${v}`, C.mini, K4((I, j) => mv(I, j) > v));
  for (const N of [90, 180, 365]) C.run(`К4 без MVRV < 1 за ${N} дн`, C.mini, K4((I, j) => !(I['k4_mvmin' + N][j] < 1)));
}
if (mode === 'wide') { // то же для всех продаж на страхе (не только К4): у дна цикла продажи на страхе ×m
  for (const v of [1, 1.1]) for (const m of [0.5, 0]) C.run(`страх ×${m} при MVRV < ${v} (К4 как есть)`, C.mini, K4(() => true, (ctx, f, a) => (f === 'fear' && mv(ctx.X.ind, ctx.j) < v && a < 0 ? (m ? C.sellAct(a, m) : 1e-6) : a)));
  for (const m of [0.5, 0]) C.run(`страх ×${m} при MVRV < 1 за 180 дн (К4 как есть)`, C.mini, K4(() => true, (ctx, f, a) => (f === 'fear' && ctx.X.ind.k4_mvmin180[ctx.j] < 1 && a < 0 ? (m ? C.sellAct(a, m) : 1e-6) : a)));
}
if (mode === 'eps') { // без эпизода: правило «К4 при MVRV > 1» выключено в окне (там К4 как есть)
  const W = { ...C.EPS, '2022-11..2023-01': ['2022-11-01', '2023-01-31'], '2018–19': ['2018-11-01', '2019-04-30'], '2023': ['2023-01-01', '2023-12-31'] };
  for (const [nm, [a, b]] of Object.entries(W)) { C.setWindow(a, b); C.run(`К4 при MVRV > 1, без ${nm}`, C.mini, K4((I, j) => mv(I, j) > 1 || I.c7_out[j] < 0.5)); }
}
if (mode === 'big') { // фильтр цикла только для крупных (MVRV — метрика держателей BTC; альты у дна BTC часто продолжают падать к BTC)
  const big = (I, j) => I.isbig[j] > 0.5;
  for (const v of [1, 1.1, 1.2]) C.run(`К4: крупные только при MVRV > ${v}`, C.mini, K4((I, j) => !big(I, j) || mv(I, j) > v));
  for (const N of [90, 180, 365]) C.run(`К4: крупные без MVRV < 1 за ${N} дн`, C.mini, K4((I, j) => !big(I, j) || !(I['k4_mvmin' + N][j] < 1)));
  const W = { ...C.EPS, '2022-11..2023-01': ['2022-11-01', '2023-01-31'], '2018-11..2019-04': ['2018-11-01', '2019-04-30'] };
  for (const [nm, [a, b]] of Object.entries(W)) { C.setWindow(a, b); C.run(`  без ${nm}: крупные без MVRV < 1 за 180 дн`, C.mini, K4((I, j) => !big(I, j) || !(I.k4_mvmin180[j] < 1) || I.c7_out[j] < 0.5)); }
}
if (mode === 'mine') {
  const big = (I, j) => I.isbig[j] > 0.5;
  const P0 = K4(() => true), P1 = K4((I, j) => !big(I, j) || !(I.k4_mvmin180[j] < 1));
  console.log('монеты пользователя: итог к DCA %, худший сдвиг 0/1 (черновик → с правилом), крупная?');
  for (const nm of C.MINE) { const X = C.BY[nm]; if (!X) continue; console.log(`${nm}: ${Math.round(C.E(X, C.mini, P0))} → ${Math.round(C.E(X, C.mini, P1))} ${X.ind.isbig[X.n - 1] > 0.5 ? '(крупная)' : ''}`); }
  // по годам: среднее Δ ln капитала за год (крупные из всех групп)
  const cap = (X, p0) => { const p = { ...p0, trace: [] }; C.P.edge(X, C.mini, 0, 'full', false, p); return p.trace.map(([i, cash, u]) => cash + u * X.c[i]); };
  const yrs = {};
  for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of L.G[g]) { if (!(X.ind.isbig[X.n - 1] > 0.5)) continue;
    const V = cap(X, P1), W = cap(X, P0); let prev = 0; const y0 = (i) => +L.day(X.ind.t[i]).slice(0, 4);
    for (let i = 0; i < X.n; i++) { if (!(i === X.n - 1 || y0(i + 1) !== y0(i))) continue; const e = Math.log(V[i] / W[i]); (yrs[y0(i)] = yrs[y0(i)] || []).push(e - prev); prev = e; } }
  console.log('крупные, по годам: среднее Δ ln (с правилом − черновик) (лучше/хуже)');
  console.log(Object.keys(yrs).sort().map((y) => { const a = yrs[y]; const s = a.reduce((p, q) => p + q, 0) / a.length; return `${y}: ${C.sg(s)} (${a.filter((x) => x > 0.005).length}/${a.filter((x) => x < -0.005).length})`; }).join('  '));
  // какие монеты крупные
  const bigs = []; for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of L.G[g]) if (X.ind.isbig[X.n - 1] > 0.5) bigs.push(X.name || X.sym); console.log('крупные:', [...new Set(bigs)].join(' '));
}
