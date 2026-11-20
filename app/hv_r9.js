/* hv, круг 9: карта плато финалиста по T × U × m (строгая, сегмент БД, PUMP), чтобы выбрать устойчивую точку; провалы продаж новых правил
   (новая копия продала, а монета через год выросла ×3 и выше от цены продажи). */
const H = require('./hv_lib.js'), { c, G } = H;
const { build } = require('./hv_r7.js');
const rows = [];
for (const T of [100, 105, 110, 115, 120, 125, 130]) for (const U of [150, 200, 250]) for (const m of [1.5, 2]) {
  const o = H.ev(`T${T} U${U} ×${m}`, build({ T, U, mp: m, mw: m, me: m }), H.polW, { quiet: true });
  const p = H.E(H.BY.PUMP, o.S, H.polW);
  rows.push(`T${T} U${U} ×${m}: доход ${H.sg(o.all)} ${o.ok ? '✔' : '✗'} | БД ${H.sg(o.hvInc)} 81 ${H.sg(o.hv81.m, 3)} (${o.hv81.u}/${o.hv81.d}) 100н ${H.sg(o.nhv.m, 3)} (${o.nhv.u}/${o.nhv.d}) | 81 ${H.sg(o.m81.m, 3)} 100н ${H.sg(o.n.m, 3)} | PUMP ${p.toFixed(0)}${o.why ? ' | ' + o.why.slice(0, 60) : ''}`);
  console.log(rows[rows.length - 1]);
}
// провалы продаж новых правил (копии с hvv): сдвиг 0, 81 монета + 100 новых
function fails(S, lists = ['sel', 'ex', 'rnd', 'n100']) {
  let n = 0, bad = 0; const ex = [];
  for (const g of lists) for (const X of G[g]) {
    const { tr } = H.P.edge(X, S, 0, 'full', true, H.polW);
    for (const t of tr) { if (t.s > 0 || !S.rules[t.q].conds.some((x) => x.ind === 'hvv')) continue; n++;
      let mx = 0; for (let k = t.i; k < Math.min(X.n, t.i + 365); k++) mx = Math.max(mx, X.c[k]); if (mx >= 3 * t.p) { bad++; if (ex.length < 30) ex.push(`${X.name} ${H.day(X.ind.t[t.i])} ×${(mx / t.p).toFixed(1)}`); } }
  }
  return { n, bad, ex };
}
for (const m of [1.5, 2]) { const f = fails(build({ mp: m, mw: m, me: m })); console.log(`провалы ×${m}: продаж новыми правилами ${f.n}, монета потом ×3 и выше за год: ${f.bad} — ${f.ex.join(', ')}`); }
{ const f = fails(H.S5); console.log(`(у combo5 копий нет: ${f.n})`); }
// для сравнения — провалы исходных правил тех же семей у combo5 (53–55, 40–51, 57–58)
{ let n = 0, bad = 0; for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) { const { tr } = H.P.edge(X, H.S5, 0, 'full', true, H.polW);
    for (const t of tr) { if (t.s > 0 || !((t.q >= 39 && t.q <= 54) || t.q === 56 || t.q === 57) || t.q === 51) continue; n++; let mx = 0; for (let k = t.i; k < Math.min(X.n, t.i + 365); k++) mx = Math.max(mx, X.c[k]); if (mx >= 3 * t.p) bad++; } }
  console.log(`combo5, те же семьи: продаж ${n}, потом ×3: ${bad} (${(100 * bad / n).toFixed(1)}%)`); }
