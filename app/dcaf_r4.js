/* dcaf, круг 2: (1) фаза 4-летнего цикла халвинга как фильтр взноса / продажи / докупки; (2) «ловушка для фитилей» — лимитки ниже рынка из резерва.
   Запуск: node dcaf_r4.js [cyc|wick] */
const L = require('./r4_lib.js'), { S0, c, P } = L;
const HV = ['2012-11-28', '2016-07-09', '2020-05-11', '2024-04-20'].map((d) => Math.round(Date.parse(d) / 864e5));
L.addInd('hday', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const t = X.ind.t[i]; let h = HV[0]; for (const v of HV) if (v <= t) h = v; a[i] = t - h; } return a; });
const Z0 = 1e-6;
const F = (rules, first = false) => { const S = L.clone(); if (first) S.rules.unshift(...rules); else S.rules.push(...rules); return S; };
const out = (r) => console.log(r.txt.slice(0, 175));
const V = process.argv[2] || 'cyc';
L.run('combo4', S0);
if (V === 'cyc') {
  console.log('— A: копить взнос в «медвежьей» фазе цикла (дни после халвинга a…b) —');
  for (const [a, b] of [[550, 850], [600, 900], [500, 800], [550, 950], [650, 900]]) out(L.run(`копить ${a}…${b}`, F([{ act: Z0, conds: [c('hday', '>', a), c('hday', '<', b)] }]), L.pol0, { quiet: true }));
  console.log('— B: докупка из резерва в «донной» фазе (обычные дни) —');
  for (const [a, b] of [[850, 1000], [800, 1050], [880, 980]]) for (const f of [0.01, 0.03]) out(L.run(`докупка ${a}…${b} ${f}`, F([{ act: 1 + f, conds: [c('hday', '>', a), c('hday', '<', b)] }]), L.pol0, { quiet: true }));
  console.log('— C: продажа в «вершинной» фазе (обычные дни, монета > 1,2 своей 200д) —');
  for (const [a, b] of [[450, 560], [400, 580], [480, 600]]) for (const s of [0.02, 0.05]) out(L.run(`продажа ${a}…${b} ${s}`, F([{ act: -s, conds: [c('hday', '>', a), c('hday', '<', b), c('sma200', '>', 1.2)] }]), L.pol0, { quiet: true }));
  console.log('— D: A + B вместе —');
  for (const [a, b, d, e] of [[550, 850, 850, 1000], [600, 880, 880, 1000]]) for (const f of [0.01, 0.03]) out(L.run(`копить ${a}…${b} + докупка ${d}…${e} ${f}`, F([{ act: Z0, conds: [c('hday', '>', a), c('hday', '<', b)] }, { act: 1 + f, conds: [c('hday', '>', d), c('hday', '<', e)] }]), L.pol0, { quiet: true }));
}
if (V === 'wick') {
  const W = (lv, age = 60) => ({ ...L.pol0, wick: { lv, age } });
  for (const lv of [[[0.15, 0.05]], [[0.2, 0.1]], [[0.3, 0.1]], [[0.3, 0.2]], [[0.4, 0.2]], [[0.5, 0.3]], [[0.2, 0.05], [0.35, 0.1], [0.5, 0.2]], [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]]])
    out(L.run('фитили ' + lv.map(([k, f]) => `−${k * 100}%:${f * 100}%`).join(' '), S0, W(lv), { quiet: true }));
}
