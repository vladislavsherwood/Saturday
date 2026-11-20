/* h2, круг 2: плато «зона дна × страх < q → +f резерва» (место — перед продажами на страхе) + в зоне при страхе ≥ q не продавать (пара правил).
   Метрики сверх run(): 81 — средний лог по 81 монете к основе (лучше/хуже), половины — доход по 1-й / 2-й половине истории.
   Запуск: node h2_r2.js [wick|plain] [часть: q|pair|all] */
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', part = process.argv[3] || 'all', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const Z = (zc, act, extra = []) => ({ act, conds: [...zc, ...extra, c('btcr30', '<', 20)] });
const zones = { 'mvrv<1': [c('mvrv', '<', 1)], 'mvrv<1,1': [c('mvrv', '<', 1.1)], 'wma<1': [c('h2wma', '<', 1)], 'wma<1,2': [c('h2wma', '<', 1.2)], 'ath>70': [c('btcath', '>', 70)], 'ath>65': [c('btcath', '>', 65)] };
const ext = (r) => { const m = H.m81(r), h = H.halves(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d} | пол ${L.sg(h.h1)} / ${L.sg(h.h2)}${r.w ? ' | ' + r.w.slice(0, 120) : ''}`; };
const go = (nm, S) => console.log(ext(H.run(nm, S, pol, { n100: true, quiet: true })));
if (part === 'q' || part === 'all') for (const [zn, zc] of Object.entries(zones)) for (const q of [20, 22, 25, 28, 30, 35, 40]) for (const f of [0.03, 0.05, 0.1]) go(`${zn}, страх<${q} → +${f * 100}%`, H.ins([Z(zc, 1 + f, [c('fng', '<', q)])], 10));
if (part === 'pair' || part === 'all') for (const [zn, zc] of Object.entries(zones)) for (const q of [20, 25, 30]) for (const [an, a2] of [['копить', 1e-6], ['взнос', 1]]) go(`${zn}, страх<${q} → +5%, иначе ${an}`, H.ins([Z(zc, 1.05, [c('fng', '<', q)]), Z(zc, a2)], 10));
