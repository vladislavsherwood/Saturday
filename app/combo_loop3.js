/* Объединение, шаг 6 (по монетам): C4 агента 3 («бета к BTC за 180 дн > 1,2 и монета ниже средней 200 → каждая продажа ×1,5») поверх F и вместе с C (rel180).
   Пересечение: обе правки увеличивают продажи у «слабых» монет. Сравниваю: F + C4; F + C1.25; «максимум» — монета слабая по любому признаку получает
   свой множитель, но не произведение (копия C4 стоит первой, затем копия C, затем исходное правило — срабатывает первая); «произведение» — копия
   с обоими условиями ×(1,5·1,25) первой; «один множитель на объединённый признак» ×1,25/×1,5; плато C4 (бета 1,0…1,4 × ×1,25…×2).
   Гипотеза: C и C4 ловят разные монеты (отставание от BTC против высокой беты под средней 200) — «максимум» даст больше, чем каждая отдельно,
   а «произведение» перегнёт продажи (провалы половин). Запуск: node app/combo_loop3.js <out.json> */
const K = require('./combo_sim.js');
const fs = require('fs');
const { c } = K;
const G = K.groups(); K.prep(G);
const C4c = (b = 1.2) => [c('beta180', '>', b), c('sma200', '<', 1)], Cc = [c('rel180', '<', -15)];
// копии перед каждым правилом продажи: список [условия, множитель] по порядку (первая срабатывает)
const scaleSells = (S, L) => ({ ...S, rules: S.rules.flatMap((r) => (r.act < 0 ? [...L.map(([cs, k]) => ({ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...cs] })), r] : [r])) });
const F6 = K.withC6(K.F);
const L = [['F', K.F], ['F + C6', F6], ['W25 + C4 (агент 3)', scaleSells(K.W25, [[C4c(), 1.5]])]];
for (const [nm, S] of [['F', K.F], ['F + C6', F6]]) {
  L.push([`${nm} + C1.25`, scaleSells(S, [[Cc, 1.25]])]);
  for (const b of [1.0, 1.2, 1.4]) for (const k of [1.25, 1.5, 2]) L.push([`${nm} + C4 β>${b} ×${k}`, scaleSells(S, [[C4c(b), k]])]);
  L.push([`${nm} + max(C4 ×1,5, C ×1,25)`, scaleSells(S, [[C4c(), 1.5], [Cc, 1.25]])]);
  L.push([`${nm} + max(C4 ×1,25, C ×1,25)`, scaleSells(S, [[C4c(), 1.25], [Cc, 1.25]])]);
  L.push([`${nm} + произведение C4 ×1,5 · C ×1,25`, scaleSells(S, [[[...C4c(), ...Cc], 1.875], [C4c(), 1.5], [Cc, 1.25]])]);
  L.push([`${nm} + C1.25 и C4 только если не C (C4 ×1,5 при rel180 ≥ −15)`, scaleSells(S, [[Cc, 1.25], [C4c(), 1.5]])]);
}
const base = K.ev(G, K.W25), fb = K.ev(G, K.F), R = {};
for (const [t, S] of L) {
  const r = K.ev(G, S); R[t] = r; const [bf, wf] = K.bw(r, fb, 'n100');
  console.log(`к F ${K.d(r, fb) >= 0 ? '+' : ''}${K.d(r, fb).toFixed(3)} ${K.strictWhy(r, fb)} | к W25 ${K.d(r, base).toFixed(3)} ${K.passes(r, base) ? '✔' : '·'} | ${K.line(r)} | 100н ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} к F +${bf}/−${wf} | вершины ${r.m.sellToTop.toFixed(0)}/${r.m.missedTops.toFixed(1)} дно ${r.m.zone15.toFixed(1)}/${r.m.bott3.toFixed(0)} | ${t}`);
}
fs.writeFileSync(process.argv[2], JSON.stringify({ L: Object.fromEntries(L), R }));
