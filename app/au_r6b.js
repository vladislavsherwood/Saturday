/* au, круг 6б: разгон серебра → продать ОДИН раз за эпизод (ежедневная продажа в 6 даёт обрывы по порогу).
   Индикатор agx_X = 1 в первый день, когда условие верно после ≥ 30 дней без него. Продать f позиции; место — после покупок (11) или в конце; ± BTC > 200д.
   Запуск: node au_r6b.js > scratchpad/au/r6b.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const first = (name, f) => A.L.addInd(name, (X) => { const I = X.ind, o = new Float64Array(X.n); let last = -1e9; for (let i = 0; i < X.n; i++) { const on = f(I, i); if (on && i - last > 30) o[i] = 1; if (on) last = i; } return o; });
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
for (const [s, xs, f] of [['ag', [10, 12, 15, 18, 20], (x) => (I, i) => I.ag_r30[i] > x], ['sg', [6, 8, 10, 12], (x) => (I, i) => I.agau30[i] > x]]) for (const x of xs) {
  const nm = `ax_${s}${x}`; first(nm, f(x));
  for (const fr of [0.1, 0.2, 0.3]) { R(`${s} ${x} один раз ${fr} @11`, A.ins([{ act: -fr, conds: [c(nm, '>', 0.5)] }], 11)); }
  R(`${s} ${x} один раз 0.2 в конце`, A.ins([{ act: -0.2, conds: [c(nm, '>', 0.5)] }], S6.rules.length));
  R(`${s} ${x} один раз 0.2 @11 BTC>200`, A.ins([{ act: -0.2, conds: [c(nm, '>', 0.5), c('btc200', '>', 1)] }], 11));
}
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
