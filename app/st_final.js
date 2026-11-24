/* st, финал: кандидат AB + B + F поверх combo6 → found/st-best.json (полный список правил, вставки, индикаторы, результаты, предупреждения).
   AB — перед правилом 12 (продажи на страхе): usdtd < 7,6 & fng < 52 & btcr90 < −25 & st_bxr90 < −30 → копить (1e-6);
   B  — перед каждым правилом покупки 1–9: копия с условием st_vixr > 1,5 и долей резерва × 2 (act = 1 + (act − 1) × 2);
   F  — перед каждым правилом фандинга 29–31: копия с условием st_vix > 30 → копить (1e-6).
   Запуск: node st_final.js */
const fs = require('fs');
const ST = require('./st_lib.js'), { c, S6, P, L, T } = ST;
const R6 = (x) => Math.round(x * 1e6) / 1e6;
const FEAR = [c('usdtd', '<', 7.6), c('fng', '<', 52)];
const isB9 = (r) => r.act > 1.0001 && S6.rules.slice(0, 9).some((q) => JSON.stringify(q) === JSON.stringify(r));
const tag = (r, o) => Object.assign(r, { st: o });
const AB = (S) => ST.ins([tag({ act: 1e-6, conds: [...FEAR, c('btcr90', '<', -25), c('st_bxr90', '<', -30)] }, { part: 'AB', before_rule: 12, what: 'не продавать на страхе, когда BTC упал > 25% за 90 дн и отстал от Nasdaq-100 > 30 п.п.' })], 11, S);
const B = (S) => ST.preMod(isB9, (r) => tag({ act: R6(1 + (r.act - 1) * 2), conds: [...r.conds, c('st_vixr', '>', 1.5)] }, { part: 'B', act_was: r.act, what: 'всплеск VIX (VIX / SMA50 > 1,5): доля резерва правила покупки × 2' }), S);
const F = (S) => ST.preMod((r) => r.act < 0 && r.conds.some((q) => q.ind === 'fund30'), (r) => tag({ act: 1e-6, conds: [...r.conds, c('st_vix', '>', 30)] }, { part: 'F', act_was: r.act, what: 'VIX > 30: продажу на высоком фандинге не делать (копить)' }), S);
const S = F(B(AB(S6)));
// номера исходных правил для вставок
const keyOf = (r) => JSON.stringify({ act: r.act, conds: r.conds });
const orig = new Map(S6.rules.map((r, k) => [keyOf(r), k + 1]));
let next = null; const ins = [];
for (let i = S.rules.length - 1; i >= 0; i--) { const r = S.rules[i]; if (r.st) { r.st.before_rule = r.st.before_rule || next; r.st.index0 = i; ins.unshift({ index0: i, ...r.st, act: r.act, conds: r.conds }); } else next = orig.get(keyOf(r)); }
console.log(`правил ${S.rules.length} (combo6 ${S6.rules.length}), вставок ${ins.length}`);
for (const x of ins) console.log(`  ${x.index0} перед правилом ${x.before_rule} [${x.part}]: ${x.conds.map((q) => q.ind + q.op + q.v).join(' & ')} → ${x.act}${x.act_was != null ? ` (было ${x.act_was})` : ''}`);
const r = ST.ev('combo6 + st (AB + B + F)', S);
// проверка: совпадает с st_r9
const res = { combo6: { sel: 5403, ex: 2708, rnd: 958 }, st: { sel: Math.round(r.RS.sel.all.med), ex: Math.round(r.RS.ex.all.med), rnd: Math.round(r.RS.rnd.all.med),
  income: { all: +r.dseg.all.toFixed(3), big: +r.dseg.big.toFixed(3), alt: +r.dseg.alt.toFixed(3), meme: +r.dseg.meme.toFixed(3) }, strict: !r.w,
  m81: +r.m81.m.toFixed(4), better_worse81: `${r.m81.u}/${r.m81.d}`, n100_mlog: +r.n100.m.toFixed(4), n100_better_worse: `${r.n100.u}/${r.n100.d}`, n100_median: Math.round(r.n100.med), halves_income: [+r.hv.h1.toFixed(3), +r.hv.h2.toFixed(3)] } };
const parts = {}; for (const [nm, Q] of [['AB', AB(S6)], ['B', B(S6)], ['F', F(S6)], ['AB0 (то же без условия к Nasdaq: btcr90 < −25)', ST.ins([{ act: 1e-6, conds: [...FEAR, c('btcr90', '<', -25)] }], 11)]]) {
  const q = ST.ev('  часть ' + nm, Q); parts[nm] = { income: +q.dseg.all.toFixed(3), big: +q.dseg.big.toFixed(3), alt: +q.dseg.alt.toFixed(3), meme: +q.dseg.meme.toFixed(3), strict: !q.w, m81: +q.m81.m.toFixed(4), n100: +q.n100.m.toFixed(4), n100_bw: `${q.n100.u}/${q.n100.d}` }; }
const mine = ST.mine(S).map((x) => ({ coin: x.nm, combo6: Math.round(x.b), st: Math.round(x.x), dlog: +(ST.L1(x.x) - ST.L1(x.b)).toFixed(3) }));
console.log('монеты пользователя:', ST.mineTxt(ST.mine(S)));
const out = {
  name: 'st-best: combo6 + фильтры фондового рынка (крипта против акций)',
  base: 'combo6-best.json (76 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + ловушка для фитилей (без изменений)',
  verdict: 'Кандидат, не замена; ТОЛЬКО БЕЗ ПЛЕЧА (с маржой ×1,45 часть AB даёт ликвидации — для маржи только B + F, см. rules_margin): прибавка есть и устойчива по стенду, но почти вся — от «не продавать на страхе после обвала BTC» (это работает и без акций) и от всплесков VIX (2020-03, 2024-08, 2025-04). Сама «относительная сила к акциям» добавляет мало (+0,01…+0,02 дохода к варианту без Nasdaq).',
  idea: [
    'AB: перед продажами на страхе (правило 12) — если BTC за 90 дней упал больше чем на 25% И отстал от Nasdaq-100 больше чем на 30 п.п. (лог-доходности за 90 дн), продажу на страхе не делать, взнос в резерв («копить»).',
    'B: перед каждым правилом покупки 1–9 — если VIX выше своей 50-дн. средней в 1,5 раза (всплеск страха на фондовом рынке), то же правило с долей резерва ×2 (1,25 → 1,5; 1,5 → 2; 1,625 → 2,25; 1,1 → 1,2; 2 → 3; правила паники остаются правилами паники — отложенная покупка Boost работает и для копий).',
    'F: перед правилами продаж на высоком фандинге 29–31 — если VIX > 30, не продавать (копить).'],
  indicators: {
    st_bxr90: 'BTC минус Nasdaq-100 за 90 календарных дней: (ln(BTC_t / BTC_{t−90}) − ln(NDX_t / NDX_{t−90})) × 100. NDX (^NDX, Yahoo) по торговым дням, на календарь — последним закрытием (ffill). Python: ndx = ndx.reindex(pd.date_range(...)).ffill(); (np.log(btc/btc.shift(90)) - np.log(ndx/ndx.shift(90))) * 100',
    btcr90: 'уже есть (рост BTC за 90 дн, %)',
    st_vixr: 'VIX / SMA50(VIX) по торговым дням (^VIX, Yahoo), на календарь ffill. Python: (vix / vix.rolling(50).mean()).reindex(cal).ffill()',
    st_vix: '^VIX, закрытие, на календарь ffill',
    timing: 'закрытие США (~21:00 UTC) раньше закрытия суток крипты (00:00 UTC); решение — по вчерашнему дню, как у остальных правил. Данные: python3 st_data.py → cache/st_mkt.json (data.history).' },
  insert: ins,
  rules: S.rules.map(({ act, conds }) => ({ act, conds })),
  results: res, parts, user_coins_full_history: mine,
  margin_145: {
    how: 'st_margin.py (по образцу h2_margin.py / hv2_margin.py): 5 портфелей спот-маржи, сдвиги −1/0/+1, стресс −20/−30%; 4 перпа (USELESS, XMR, ZEC, FARTCOIN) на одном счёте; фитили не моделируются',
    combo6: '0 ликвидаций, запас 1,66; перпы медиана +917%, 0 ликвидаций',
    st_best: 'ЛИКВИДАЦИИ на всех 5 портфелях при стрессе −20/−30% (и 1 без стресса на M при сдвиге +1), запас 1,07; перпы медиана +1586%, 0 ликвидаций',
    parts: 'AB — источник ликвидаций (удержание вместо продажи на страхе держит заёмную позицию в обвал); AB «только взнос» — меньше, но тоже (M, P3+BTC); B, B×1,5, F, B + F — 0 ликвидаций, запас 1,66 как у combo6',
    b_plus_f: 'B + F: 0 ликвидаций, запас 1,66; P9 +1931/+2326/+1925 (combo6 +1935/+2316/+1895); перпы медиана +923%, 0 ликвидаций при −20/−30%' },
  rules_margin: { what: 'вариант для маржи ×1,45: только B + F (без AB) — 88 правил; доход +0,126 ✔, 81 +0,048 (64/7), 100н +0,029 (60/12), половины +0,05/+0,05', rules: F(B(S6)).rules.map(({ act, conds }) => ({ act, conds })) },
  robustness: {
    plateau: 'AB: x −25…−40, y −20…−30 — все ✔ (доход +0,17…+0,30); B: порог 1,3–1,5 ✔, 1,6–1,8 ✗ на волоске (худшая половина альтов 50 случ. −63,6 против −63,6), ×1,5…×2,5 ✔; F: VIX 22–35 ✔.',
    leave_one_out: 'без 2018 / 2018-11…2019-02 / 2019 / 2020-03 / 2021-01…04 / 2021-05…08 / 2022 / 2024-08 / 2025-10…2026-02 — ✔, доход +0,13…+0,28, 100н +0,05…+0,10; без 2025-03…05 — строгая ✗ на сотые (экзамен, альты, худшая половина 26,1 < 26,3), доход +0,20.',
    halves: 'доход по половинам +0,36 / +0,05' },
  warnings: [
    'Главная часть (AB) держится на двух эпизодах — 2021-05…08 и 2022 (июнь–сентябрь); без 2022 доход финалиста +0,13 (а у самого AB около 0).',
    'Условие к Nasdaq в AB почти не работает: тот же фильтр по одному падению BTC (btcr90 < −25) даёт +0,126 против +0,140 — фондовый рынок здесь скорее «подтверждение», чем самостоятельный сигнал.',
    'B срабатывает в немногих эпизодах всплеска VIX при сигнале покупки combo6: 2020-03, 2024-08, 2025-03/04, 2025-10-16, 2026-03 (у BTC ещё 2016 и 2018-02); без 2025-03…05 строгая ✗ на сотые.',
    'F — продажи на фандинге при VIX > 30 редки: 2020-02/03, 2020-09, 2021-01/02, 2021-12; доход +0,03.',
    'В 100 новых нет изменений у крупных (крупных там почти нет); прибавка 100 новых — альты +0,10, мемы +0,01.',
    'Сильные «чистые» прогнозы из диагностики (DXY за 90 дн ±4%, ставки ±0,5 п.п.) в правила не переносятся: правила combo6 уже срабатывают в эти дни, добавки и фильтры по DXY/ставкам — отвергнуты (круг 6).'],
  from: 'research/st_journal.md, st_lib.js, st_r0 … st_r10.js, st_final.js, st_margin.py (2026-11-24)',
};
fs.writeFileSync(__dirname + '/found/st-best.json', JSON.stringify(out, null, 1));
console.log('записано found/st-best.json');
