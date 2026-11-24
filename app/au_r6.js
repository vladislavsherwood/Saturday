/* au, круг 6: «серебро разгоняется → крипта хуже 1–3 месяца» (круг 2: p 0,05–0,07). Варианты:
   S — продать f позиции, если серебро +X% за 30 дн (или лучше золота на X п.п.), место: после покупок (11) | в конце; ± BTC > 200д;
   N — не покупать из резерва: правила покупки 0–8, 27 (btcr30 > 20 → 2), 59 при разгоне серебра → только взнос (act 1);
   K — копить: в обычные дни при разгоне серебра взнос в резерв (act 1e-6). Запуск: node au_r6.js > scratchpad/au/r6.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
const SIG = { ag: (x) => [c('ag_r30', '>', x)], sg: (x) => [c('agau30', '>', x)], au: (x) => [c('au_r30', '>', x)] };
const buys = (r) => r.act > 1.0001;
for (const [s, xs] of [['ag', [10, 15, 20]], ['sg', [6, 8, 10]], ['au', [6, 8]]]) for (const x of xs) {
  for (const f of [0.05, 0.1]) { R(`${s} ${x} продать ${f} @11`, A.ins([{ act: -f, conds: SIG[s](x) }], 11)); R(`${s} ${x} продать ${f} в конце`, A.ins([{ act: -f, conds: SIG[s](x) }], S6.rules.length)); }
  R(`${s} ${x} продать 0.1 @11 BTC>200`, A.ins([{ act: -0.1, conds: [...SIG[s](x), c('btc200', '>', 1)] }], 11));
  R(`${s} ${x} не покупать из резерва`, A.preMod(S6, (r) => buys(r), (r) => ({ act: 1, conds: [...r.conds, ...SIG[s](x)] })));
  R(`${s} ${x} копить в обычные дни`, A.ins([{ act: 1e-6, conds: SIG[s](x) }], S6.rules.length));
}
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
