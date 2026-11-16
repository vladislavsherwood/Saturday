/* r4, круг 9: долгие собственные ралли (ZEC) — «пол» доли монеты и возврат в прорыв.
   Диагностика (node r4_zec.js): combo4 на ZEC — вся история +654% к DCA, 1-я половина +960%, 2-я −48%. В августе–сентябре 2025 по $36–53 стратегия продала всё
   по рыночным сигналам (эйфория 5%/день, продажи на страхе < 52, тихая вершина) — за месяц до собственного ралли ZEC ×15; потом покупала на панике по $520–610.
   Гипотезы (новый поворот; «лидеру продавать меньше» отвергали агент 3, imp3, seg_alt):
   (а) «пол»: не продавать, если доля монеты в портфеле уже ниже F (состояние самой стратегии, не признак монеты) — в долгом ралли остаётся F монеты;
   (б) «возврат в прорыв»: монета на новом 90-дн. максимуме и сильно обгоняет BTC (rel180 > R) → купить x% резерва (в т. ч. вместо продажи на страхе).
   Критерий (заранее): строгая ✔ везде, доход ≥ 0 на 81 монете; ZEC 2-я половина заметно лучше (> −30%) — иначе не лечит. Запуск: node r4_r9.js */
const L = require('./r4_lib.js'), { S0, c } = L, R4 = require('./r4_sim.js'), ZX = require('./r4_zec.js').zec();
const zline = (S, pol, hk) => `ZEC: вся ${R4.E(ZX, S, 'full', pol, hk).toFixed(0)}%, 1-я ${R4.E(ZX, S, 'h1', pol, hk).toFixed(0)}%, 2-я ${R4.E(ZX, S, 'h2', pol, hk).toFixed(0)}%`;
console.log('combo4 |', zline(S0, L.pol0, null));
console.log('— (а) пол доли монеты: при доле < F продажи не исполняются —');
const floor = (F, only = null) => ({ sell: ({ share, r }) => (share < F && (!only || only(r)) ? 0 : 1) });
for (const F of [0.05, 0.1, 0.2, 0.3, 0.5]) { const hk = floor(F); const r = R4.run(`пол ${F * 100}%`, S0, L.pol0, hk); console.log('   ', zline(S0, L.pol0, hk)); }
console.log('— (а2) пол только для продаж на страхе и эйфории (вершины продаются полностью) —');
const soft = (r) => r.conds.some((x) => x.ind === 'usdt' || (x.ind === 'fng' && x.op === '<'));
for (const F of [0.1, 0.2, 0.3, 0.5]) { const hk = floor(F, soft); R4.run(`пол ${F * 100}% (страх, эйфория)`, S0, L.pol0, hk); console.log('   ', zline(S0, L.pol0, hk)); }
console.log('— (б) возврат в прорыв: hi90 и rel180 > R → купить x% резерва; позиция: перед продажами на страхе (после охраны) —');
const brk = (R, x, extra = []) => { const S = L.clone(); const i = S.rules.findIndex((r) => r.act === 1) + 1; S.rules.splice(i, 0, { act: 1 + x, conds: [c('hi90', '>', 0.5), c('rel180', '>', R), ...extra] }); return S; };
for (const R of [50, 100, 200]) for (const x of [0.1, 0.25]) { const S = brk(R, x); L.run(`прорыв rel180 > ${R} → ${x * 100}%`, S); console.log('   ', zline(S, L.pol0, null)); }
console.log('— (б2) то же последним правилом (только когда ничего не сработало) —');
for (const R of [50, 100, 200]) { const S = L.clone(); S.rules.push({ act: 1.1, conds: [c('hi90', '>', 0.5), c('rel180', '>', R)] }); L.run(`прорыв последним rel180 > ${R} → 10%`, S); console.log('   ', zline(S, L.pol0, null)); }
