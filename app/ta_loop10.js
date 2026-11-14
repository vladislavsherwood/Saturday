/* Агент ТА, круг 10: финальная проверка лучшего ТА-кандидата и сохранение found/ta-best.json.
   Кандидат (круг 9): «продажи на страхе ×1,25 при сжатии волатильности BTC (перцентиль ширины полос Боллинджера за 180 дн < 0,4) в нисходящем
   тренде (BTC ниже 20-недельной средней)». Проверка (заранее): соседи по порогу сжатия (0,35/0,45/0,5) и средней (0,9/1,1) — доход > 0;
   разбор по монетам (кто проигрывает), половины истории, метрики дна/вершин, 100 новых. Строгую проверку кандидат не проходит (круг 9) —
   он сохраняется как вариант для пользователя, основа остаётся лучшей по правилам проверки. Запуск: node app/ta_loop10.js <out.json> > log */
const T = require('./ta_sim.js');
const fs = require('fs');
const { c } = T;
const G = T.load(['sel', 'ex', 'rnd', 'n100', 'met']);
const base = T.ev(G, T.BASE);
const scaleF = (S, conds, k) => T.pre(S, T.isFearSell, conds, (r) => Math.max(-1, +(r.act * k).toFixed(6)));
const V = (x = 0.4, w = 1, k = 1.25) => scaleF(T.BASE, [c('b_bbwp', '<', x), c('b_w20', '<', w)], k);
const R = {};
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
for (const [t, S] of [['кандидат: ×1,25, bbwp < 0,4, BTC < 20-нед.', V()], ['×1,1, bbwp < 0,4, BTC < 20-нед.', V(0.4, 1, 1.1)],
  ['соседи: bbwp < 0,35', V(0.35)], ['bbwp < 0,45', V(0.45)], ['bbwp < 0,5', V(0.5)], ['BTC < 0,9 × 20-нед.', V(0.4, 0.9)], ['BTC < 1,1 × 20-нед.', V(0.4, 1.1)]]) {
  const r = T.ev(G, S); R[t] = { d: T.K.d(r, base), pass: T.K.passes(r, base), why: T.K.why(r, base), n100: r.n100, m: r.m, bw: T.K.bw(r, base, 'n100') };
  console.log(T.rowS(t, r, base));
}
const S = V(), r = T.ev(G, S);
console.log('\nметрики основы:   ' + T.K.fmtM(base.m) + '\nметрики кандидата: ' + T.K.fmtM(r.m));
console.log('\nпо монетам (итог / 1-я / 2-я половина; основа → кандидат), изменения > 3 п.п. или в минусе:');
const per = [];
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
  const a = ['full', 'h1', 'h2'].map((p) => T.K.E(X, T.BASE, p)), b = ['full', 'h1', 'h2'].map((p) => T.K.E(X, S, p));
  if (Math.abs(b[0] - a[0]) > 3 || Math.min(...b) < 0 || b.some((v, i) => v < a[i] - 1 && v < 20)) { per.push({ g, n: X.name, a, b }); console.log(`  ${g} ${X.name}: ${a.map((v) => v.toFixed(1)).join('/')} → ${b.map((v) => v.toFixed(1)).join('/')}`); }
}
const hm = (g, SS, p) => T.K.hmed(G, g, SS, p);
const groups = {};
for (const g of ['sel', 'ex', 'rnd', 'n100', 'met']) groups[g] = { base: { med: base[g].med, pos: base[g].pos, hpos: base[g].hpos, hworst: base[g].hworst, worst: base[g].worst, h1: hm(g, T.BASE, 'h1'), h2: hm(g, T.BASE, 'h2') },
  cand: { med: r[g].med, pos: r[g].pos, hpos: r[g].hpos, hworst: r[g].hworst, worst: r[g].worst, h1: hm(g, S, 'h1'), h2: hm(g, S, 'h2'), betterWorse: T.K.bw(r, base, g) } };
for (const g in groups) console.log(`${g}: основа ${groups[g].base.med.toFixed(0)}% (${groups[g].base.pos}, ${groups[g].base.hpos}, худш.пол. ${groups[g].base.hworst.toFixed(1)}, 1-я/2-я ${groups[g].base.h1.toFixed(0)}/${groups[g].base.h2.toFixed(0)}) → кандидат ${groups[g].cand.med.toFixed(0)}% (${groups[g].cand.pos}, ${groups[g].cand.hpos}, ${groups[g].cand.hworst.toFixed(1)}, ${groups[g].cand.h1.toFixed(0)}/${groups[g].cand.h2.toFixed(0)}; лучше/хуже ${groups[g].cand.betterWorse.join('/')})`);
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ R, per, groups, cand: S, m: { base: base.m, cand: r.m } }));
