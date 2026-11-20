/* h2: разбор варианта по монетам и по эпизодам дна (правило разрешено только в окне дат: 2015, 2018–19, 2020, 2022–23).
   Печатает: средний лог к основе по 81 монете и 100 новым (лучше/хуже), по сегментам и по году начала истории; вклад каждого эпизода; крупнейшие выигрыши/потери.
   Использование: const C = require('./h2_coin.js'); C.explain(имя, rulesFn(win), at, pol) — rulesFn(extraConds) → массив правил. */
const H = require('./h2_lib.js'), { L, P, c } = H;
const EPS = { '2015': ['2015-01-01', '2016-03-01'], '2018': ['2018-10-01', '2019-06-01'], '2020': ['2020-02-15', '2020-06-01'], '2022': ['2022-05-01', '2023-03-01'] };
const win = (a, b) => [c('t', '>', L.T(a) - 0.5), c('t', '<', L.T(b) + 0.5)];
const lists = ['sel', 'ex', 'rnd', 'n100'];
const B = new Map(); const baseR = (pol) => { if (!B.has(pol)) B.set(pol, P.evc(H.S57, pol, lists)); return B.get(pol); }; // основа — по объекту политики
const L1 = L.Z.L1;
function diff(R, pol) {
  const b = baseR(pol), o = [];
  for (const g of lists) R[g].forEach((x, i) => o.push({ g, name: x.name, seg: x.seg, d: L1(x.f) - L1(b[g][i].f), d1: L1(x.h1) - L1(b[g][i].h1), d2: L1(x.h2) - L1(b[g][i].h2), f0: b[g][i].f, f: x.f }));
  return o;
}
const agg = (a) => { const n = a.length || 1; return `${L.sg(a.reduce((s, x) => s + x.d, 0) / n)} ${a.filter((x) => x.d > 0.005).length}/${a.filter((x) => x.d < -0.005).length}`; };
function explain(nm, mk, at, pol, { top = 8, eps = true } = {}) {
  const S = H.ins(mk([]), at), R = P.evc(S, pol, lists), D = diff(R, pol);
  const o81 = D.filter((x) => x.g !== 'n100'), o100 = D.filter((x) => x.g === 'n100');
  console.log(`\n### ${nm}`);
  console.log(`81: ${agg(o81)} [к ${agg(o81.filter((x) => x.seg === 'big'))}; а ${agg(o81.filter((x) => x.seg === 'alt'))}; м ${agg(o81.filter((x) => x.seg === 'meme'))}] | 100н: ${agg(o100)} | половины 81: ${L.sg(o81.reduce((s, x) => s + x.d1, 0) / o81.length)} / ${L.sg(o81.reduce((s, x) => s + x.d2, 0) / o81.length)}, 100н ${L.sg(o100.reduce((s, x) => s + x.d1, 0) / o100.length)} / ${L.sg(o100.reduce((s, x) => s + x.d2, 0) / o100.length)}`);
  const s = [...D].sort((x, y) => y.d - x.d);
  console.log(`  лучше: ${s.slice(0, top).map((x) => `${x.name} ${L.sg(x.d)} (${Math.round(x.f0)}→${Math.round(x.f)})`).join(', ')}`);
  console.log(`  хуже: ${s.slice(-top).reverse().map((x) => `${x.name} ${L.sg(x.d)} (${Math.round(x.f0)}→${Math.round(x.f)})`).join(', ')}`);
  if (eps) for (const [e, [a, b]] of Object.entries(EPS)) {
    const Se = H.ins(mk(win(a, b)), at), De = diff(P.evc(Se, pol, lists), pol);
    const a81 = De.filter((x) => x.g !== 'n100'), a100 = De.filter((x) => x.g === 'n100');
    const se = [...De].sort((x, y) => y.d - x.d).filter((x) => Math.abs(x.d) > 0.01);
    console.log(`  эпизод ${e}: 81 ${agg(a81)} [к ${agg(a81.filter((x) => x.seg === 'big'))}; а ${agg(a81.filter((x) => x.seg === 'alt'))}; м ${agg(a81.filter((x) => x.seg === 'meme'))}] | 100н ${agg(a100)} | + ${se.slice(0, 5).map((x) => x.name + ' ' + L.sg(x.d)).join(', ')} | − ${se.slice(-5).reverse().map((x) => x.name + ' ' + L.sg(x.d)).join(', ')}`);
  }
  return D;
}
module.exports = { explain, diff, EPS, win, lists };
if (require.main === module) {
  const pol = H.base(process.argv[2] || 'wick');
  const Z = (zc, act, extra = []) => (w) => [{ act, conds: [...zc, ...extra, c('btcr30', '<', 20), ...w] }];
  explain('mvrv<1 → +2% (в зоне без продаж)', Z([c('mvrv', '<', 1)], 1.02), 10, pol);
  explain('mvrv<1 → взнос (в зоне без продаж)', Z([c('mvrv', '<', 1)], 1), 10, pol);
  explain('mvrv<1, страх<25 → +5%', Z([c('mvrv', '<', 1)], 1.05, [c('fng', '<', 25)]), 10, pol);
  explain('mvrv<1, страх<22 → +5%', Z([c('mvrv', '<', 1)], 1.05, [c('fng', '<', 22)]), 10, pol);
  explain('ath>70, страх<20 → +10%', Z([c('btcath', '>', 70)], 1.1, [c('fng', '<', 20)]), 10, pol);
}
