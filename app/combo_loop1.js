/* Объединение, шаг 1 (по монетам, быстрый оценщик): W25, F, F + C (×1,1…×1,5, на все продажи / без продаж тихой вершины / без новой продажи пампа),
   F + C6, F + C1.25 + C6; строгая проверка и доход к W25 и к F; 100 новых; метрики дна/вершин.
   Гипотеза: C и F увеличивают продажи в разных местах (C — у отстающих монет на любых сигналах, F — на тихой вершине и пампе в медвежьем рынке),
   поэтому выигрыш C поверх F сохранится хотя бы наполовину (+0,07 из +0,14); пересечение — на широкой тихой вершине (50% × 1,25 = 62,5%).
   Запуск: node app/combo_loop1.js <out.json> */
const K = require('./combo_sim.js');
const fs = require('fs');
const G = K.groups(); K.prep(G);
const L = [];
const add = (t, S) => L.push([t, S]);
add('W25', K.W25); add('F', K.F);
for (const k of [1.1, 1.25, 1.5]) add(`W25 + C${k}`, K.withC(K.W25, k));
for (const k of [1.1, 1.2, 1.25, 1.3, 1.4, 1.5]) add(`F + C${k}`, K.withC(K.F, k));
for (const k of [1.25, 1.5]) add(`F + C${k} без тихой вершины`, K.withC(K.F, k, { which: (r) => !K.isQt(r) }));
for (const k of [1.25, 1.5]) add(`F + C${k} без тихой и пампа`, K.withC(K.F, k, { which: (r) => !K.isQt(r) && !K.isBP(r) }));
add('F + C6', K.withC6(K.F));
for (const k of [1.1, 1.25, 1.5]) add(`F + C${k} + C6`, K.withC(K.withC6(K.F), k));
add('W25 + C6', K.withC6(K.W25));
const R = {}, base = K.ev(G, K.W25), fb = K.ev(G, K.F);
console.log(K.HDR);
for (const [t, S] of L) {
  const r = t === 'W25' ? base : t === 'F' ? fb : K.ev(G, S); R[t] = r;
  const [b, w] = K.bw(r, base, 'n100'), [bf, wf] = K.bw(r, fb, 'n100');
  console.log(`${K.show(t, r, base)}\n     к F: ${K.d(r, fb) >= 0 ? '+' : ''}${K.d(r, fb).toFixed(3)} ${K.strictWhy(r, fb)} | 100н к W25 +${b}/−${w}, к F +${bf}/−${wf} | худш.монета отбор ${r.sel.worst.toFixed(1)} экз ${r.ex.worst.toFixed(1)} | худш.пол. ${r.sel.hworst.toFixed(2)}/${r.ex.hworst.toFixed(2)}/${r.rnd.hworst.toFixed(2)}`);
}
fs.writeFileSync(process.argv[2], JSON.stringify({ L: Object.fromEntries(L), R }));
