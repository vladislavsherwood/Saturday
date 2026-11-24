/* au, круг 9б: «бегство в защиту» — продажи на страхе (11–26) ×m, если золото +X% за 30 дней. Плато X 1…6, m 1,25/1,5/2; кто даёт ✗ (худшая монета отбора);
   без одного года; дни срабатывания. Запуск: node au_r9b.js > scratchpad/au/r9b.txt */
const A = require('./au_lib.js'), { c, S6, T, P } = A;
const fear = (q) => q >= 11 && q <= 26;
const mk = (x, m, extra = []) => A.preMod(S6, (r, q) => fear(q), (r) => ({ act: +Math.max(-1, r.act * m).toFixed(6), conds: [...r.conds, c('au_r30', '>', x), ...extra] }));
for (const x of [1, 2, 3, 4, 5, 6]) for (const m of [1.25, 1.5, 2]) A.run(`страх ×${m}, золото +${x}%`, mk(x, m));
const { BR } = P.baseline(); const r = A.run('страх ×1.5, золото +3% (повтор)', mk(3, 1.5), A.polW, { quiet: true });
const w = (RR) => RR.sel.map((x) => [x.name, x.f]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([n, v]) => `${n} ${v.toFixed(1)}`).join(', ');
console.log('худшие монеты отбора: основа', w(BR), '| вариант', w(r.R));
console.log('изменения по монетам отбора:', r.R.sel.map((x, i) => [x.name, x.f - BR.sel[i].f]).filter(([, d]) => Math.abs(d) > 0.05).map(([n, d]) => `${n} ${d >= 0 ? '+' : ''}${d.toFixed(1)}`).join(', '));
for (const y of [2018, 2019, 2020, 2021, 2022, 2024, 2025, 2026]) { A.L.addInd('au_y' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  A.run(`×1,5 +3% без ${y}`, mk(3, 1.5, [c('au_y' + y, '<', 0.5)])); }
const M = {}; for (const g of ['sel', 'ex', 'rnd']) for (const X of A.G[g]) { const I = X.ind; for (let j = 0; j < X.n; j++) { if (!(I.au_r30[j] > 3)) continue; const q = S6.rules.findIndex((rr) => rr.conds.every((cd) => I[cd.ind] && (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))); if (fear(q)) { const m = A.day(I.t[j]).slice(0, 7); M[m] = (M[m] || 0) + 1; } } }
console.log('месяцы продаж на страхе при золоте +3%/30д (монето-дни):', Object.entries(M).sort().map(([m, k]) => `${m}:${k}`).join(' '));
