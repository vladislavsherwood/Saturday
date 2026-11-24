/* st, круг 3 — «крипта сильно отстала от акций — не продавать на страхе».
   Перед правилом 12 (первая продажа на страхе; все продажи 12–27 требуют usdtd < 7,6 и fng < 52) вставляется правило
   usdtd < 7,6 & fng < 52 & <признак отставания> → act (1e-6 — копить: взнос в резерв, ничего не продавать; 1 — только взнос; ×½ — продать вдвое меньше копиями).
   Признаки: BTC−NDX 90д (st_bxr90), 30д (st_bxr30), лог BTC/NDX к 200д (st_bxz), монета−NDX 90д (st_cxr90); контроли без акций — btcr90 (BTC за 90д) и ret90 монеты.
   Запуск: node st_r3.js */
const ST = require('./st_lib.js'), { c, S6 } = ST;
const FEAR = [c('usdtd', '<', 7.6), c('fng', '<', 52)];
const hold = (cond, act = 1e-6) => ST.ins([{ act, conds: [...FEAR, cond] }], 11);
const half = (cond, m = 0.5) => ST.preMod((r, k) => k >= 11 && k <= 26, (r) => ({ act: Math.round(r.act * m * 1e6) / 1e6, conds: [...r.conds, cond] }));
const R = {};
const go = (nm, S) => { R[nm] = ST.ev(nm, S); return R[nm]; };
console.log('вариант                                         отбор/экз/50 | доход к а м строгая | 81 | 100н | половины');
go('combo6', S6);
for (const x of [-20, -25, -30, -35, -40, -50]) go(`копить: BTC−NDX 90д < ${x}`, hold(c('st_bxr90', '<', x)));
for (const x of [-30, -40]) go(`только взнос: BTC−NDX 90д < ${x}`, hold(c('st_bxr90', '<', x), 1));
for (const x of [-30, -40]) go(`продать ×½: BTC−NDX 90д < ${x}`, half(c('st_bxr90', '<', x)));
for (const x of [-15, -20, -30]) go(`копить: BTC−NDX 30д < ${x}`, hold(c('st_bxr30', '<', x)));
for (const x of [-20, -30, -40]) go(`копить: лог BTC/NDX к 200д < ${x}`, hold(c('st_bxz', '<', x)));
for (const x of [-30, -50, -70]) go(`копить: монета−NDX 90д < ${x}`, hold(c('st_cxr90', '<', x)));
console.log('контроли без акций:');
for (const x of [-25, -35, -45]) go(`копить: BTC за 90д < ${x}`, hold(c('btcr90', '<', x)));
for (const x of [-40, -60]) go(`копить: монета за 90д < ${x}`, hold(c('ret90', '<', x)));
console.log('фон акций:');
go('копить: NDX > 200д', hold(c('st_ndx200', '>', 1))); go('копить: NDX у макс ≤3%', hold(c('st_ndxdd', '<', 3)));
go('копить: DXY 90д < −1,5', hold(c('st_dxyr90', '<', -1.5))); go('копить: DXY 90д < −3', hold(c('st_dxyr90', '<', -3)));
