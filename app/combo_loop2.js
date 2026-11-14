/* Объединение, шаг 2 (по монетам): F + C6 + C — плато по множителю, порогу и окну rel, и фильтр «возраст монеты > N дней» для условия C
   (агент 4C: провал строгой — молодая ARIA на 50 случайных; у F провал TON уже исправлен, значит с возрастом строгая к F может пройти).
   Гипотеза: «rel180 < −15 и возраст > 365…540 дней» убирает ARIA, сохраняет ≥ 80% дохода C, и F + C6 + C(возраст) проходит строгую к F.
   Запуск: node app/combo_loop2.js <out.json> */
const K = require('./combo_sim.js');
const fs = require('fs');
const G = K.groups(); K.prep(G);
const { c } = K;
// возраст: дней истории монеты в выгрузке (agei — номер дня)
const withCa = (S, k, age, w = 180, v = -15) => ({ ...S, rules: S.rules.flatMap((r) => (r.act < 0 ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, c('rel' + w, '<', v), ...(age ? [c('agei', '>', age)] : [])] }, r] : [r])) });
const L = [['F', K.F], ['F + C6', K.withC6(K.F)]];
for (const k of [1.25, 1.5]) for (const age of [0, 270, 365, 450, 540, 730]) L.push([`F + C6 + C${k} возраст>${age}`, withCa(K.withC6(K.F), k, age)]);
for (const k of [1.25]) for (const age of [0, 365, 540]) L.push([`F + C${k} возраст>${age} (без C6)`, withCa(K.F, k, age)]);
for (const w of [90, 180]) for (const v of [-10, -15, -20, -25]) for (const k of [1.25, 1.5]) L.push([`F + C6 + C${k} rel${w}<${v} возраст>365`, withCa(K.withC6(K.F), k, 365, w, v)]);
const base = K.ev(G, K.W25), fb = K.ev(G, K.F), R = {};
for (const [t, S] of L) {
  const r = K.ev(G, S); R[t] = r;
  const [bf, wf] = K.bw(r, fb, 'n100');
  console.log(`к F ${K.d(r, fb) >= 0 ? '+' : ''}${K.d(r, fb).toFixed(3)} ${K.strictWhy(r, fb)} | к W25 ${K.d(r, base).toFixed(3)} ${K.strictWhy(r, base)} | ${K.line(r)} | 100н ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos} к F +${bf}/−${wf} | вершины ${r.m.sellToTop.toFixed(0)}/${r.m.missedTops.toFixed(1)} дно ${r.m.zone15.toFixed(1)}/${r.m.bott3.toFixed(0)} | ${t}`);
}
fs.writeFileSync(process.argv[2], JSON.stringify(R));
