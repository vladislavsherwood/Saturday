/* h2, круг 4 (идея 3): «отложенная покупка дна» — в зоне (MVRV < 1) правило копит f резерва в день в долг (второй долг стенда, st.oo), не покупая сразу;
   долг (× m) тратится по развороту: usdt вниз от пика (как отложенная паника), BTC +R% от 30-дн. минимума, BTC выше своей 20д, монета +R% от своего минимума,
   выход MVRV выше 1. Долг сгорает через 60 дней после зоны. Место правила: перед продажами на страхе (в зоне не продаём) или после них (продажи остаются).
   Запуск: node h2_r4.js [wick|plain] */
const H = require('./h2_lib.js'), { L, c } = H, C = require('./h2_coin.js');
const kind = process.argv[2] || 'wick', pol = H.base(kind), bp = kind === 'wick' ? H.polW : L.pol0;
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 140) : ''}`; };
const go = (nm, rules, at, p) => console.log(ext(H.run(nm, H.ins(rules, at), p, { n100: true, quiet: true })));
const REL = {
  usdt: (I, j) => I.upk10[j] < 0.965, 'bup10': (I, j) => I.h2bup[j] > 10, 'bup15': (I, j) => I.h2bup[j] > 15, 'b20': (I, j) => I.h2b20[j] > 1.05,
  'cup20': (I, j) => I.h2cup[j] > 20, 'cup40': (I, j) => I.h2cup[j] > 40, 'mv1': (I, j) => I.mvrv[j] >= 1,
};
const exp60 = (I, j) => I.h2mvs[j] > 60;
const zr = (f, extra = []) => ({ act: 1 + f, h2: 1, conds: [c('mvrv', '<', 1), ...extra, c('btcr30', '<', 20)] });
for (const at of [10, 26]) for (const [rn, rel] of Object.entries(REL)) for (const f of [0.02, 0.05]) for (const m of [1, 2])
  go(`${at === 10 ? 'без продаж' : 'с продажами'}: mvrv<1 → долг ${f * 100}%, выдача ${rn} ×${m}`, [zr(f)], at, H.polZ({ k: 0, rel, m, exp: exp60 }, bp));
