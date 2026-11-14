/* Агент «АЛЬТЫ», круг 3: монеты, не связанные с рынком (низкая корреляция/бета к BTC за 180 дней): DHN, YOUC, TA, LBT, AGT, VCNT, ARIA, WFI…
   Гипотеза (заранее): у монеты с corr180 < x (или beta180 < x) рыночные сигналы (страх, паника, тихая вершина) не говорят ничего о ней самой;
   в такие дни лучше просто DCA — продажи и/или покупки резерва ×0 (или ×0,5). Отличие от агента 3 (круги 2, 10: бета < 0,7–1,0 → продажи ×0,5,
   отвергнуто) — только крайние значения (corr < 0,2–0,4, бета < 0,3–0,5), где монета с рынком не связана. Признак по поведению, без списка.
   Ожидание: выигрыш на 50 случайных и 100 новых (там такие монеты), отбор и экзамен почти не меняются; строгая — на остальных тоже.
   Запуск: node app/seg_alt_loop3.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
// доля дней с признаком по монетам (для понимания, кого задевает)
for (const [ind, v] of [['corr180', 0.3], ['beta180', 0.4]]) {
  const o = [];
  for (const g of Q.GR) for (const X of G[g]) { const a = X.ind[ind]; let k = 0, n = 0; for (let i = 0; i < X.n; i++) if (!isNaN(a[i])) { n++; if (a[i] < v) k++; } if (n && k / n > 0.2) o.push(`${X.name}(${g},${Math.round((100 * k) / n)}%)`); }
  console.log(`${ind} < ${v} больше 20% дней: ${o.join(' ')}`);
}
const scaleAct = (r, k) => (r.act < 0 ? Math.max(-1, r.act * k) : 1 + Math.min(1, (r.act - 1) * k));
const mod = (S, which, k, extra) => ({ ...S, rules: S.rules.flatMap((r) => (which(r) ? [{ act: +scaleAct(r, k).toFixed(6), conds: [...r.conds, ...extra] }, r] : [r])) });
const sells = (r) => r.act < 0, buys = (r) => r.act > 1, any = (r) => r.act !== 1;
const L = [];
for (const [ind, vs] of [['corr180', [0.2, 0.3, 0.4]], ['beta180', [0.3, 0.4, 0.5]], ['corr90', [0.2, 0.3]]]) for (const v of vs) {
  const f = [c(ind, '<', v)];
  for (const k of [0, 0.5]) {
    L.push([`${ind}<${v}: продажи ×${k}`, mod(B, sells, k, f)]);
    L.push([`${ind}<${v}: покупки резерва ×${k}`, mod(B, buys, k, f)]);
    L.push([`${ind}<${v}: всё ×${k} (DCA)`, mod(B, any, k, f)]);
  }
}
const out = [];
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
