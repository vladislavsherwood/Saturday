/* Агент «АЛЬТЫ», круг 5: плато «альтсезон → продать альт» (находка круга 4: жадность > 70 и доля альтов за 90 дн > +1 п.п. → 3–10% в день).
   Гипотеза (заранее): выигрыш не пик по порогу жадности: плато по жадности 60–74 и по oth90 0,5–2; при 75 эффект пропадает потому,
   что дни с жадностью > 75 уже заняты другими правилами (фандинг, тихая вершина). Проверяю также место правила (в конце / перед фандингом #19),
   окно доли альтов (oth90 → альтов растёт), то же правило на всех монетах, и проверяю, совпадает ли оно с широкой тихой вершиной A1 (круг 2).
   Запуск: node app/seg_alt_loop5.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const ALT = c('isalt', '>', 0.5);
const ins = (S, rule, at = S.rules.length) => ({ ...S, rules: [...S.rules.slice(0, at), rule, ...S.rules.slice(at)] });
const AS = (f, o, s, alt = true) => ({ act: -s, conds: [...(alt ? [ALT] : []), c('fng', '>', f), c('oth90', '>', o)] });
// A1: широкая тихая вершина ×1,5 у альтов (круг 2)
const up = (S, qs, k, extra) => ({ ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...extra] }, r] : [r])) });
const A1 = up(B, [23, 24], 1.5, [ALT]);
// сколько дней правило срабатывает (fng>f и oth90>o) и сколько из них свободны в основе
{ const X = G.sel.find((x) => x.name === 'LINK'), I = X.ind; const R = require('./agent_sim.js');
  for (const f of [60, 65, 70, 75]) { let all = 0, free = 0; const comp = B.rules; for (let i = 0; i < X.n; i++) if (I.fng[i] > f && I.oth90[i] > 1) { all++; const q = comp.findIndex((r) => r.conds.every((cd) => (cd.op === '<' ? I[cd.ind][i] < cd.v : I[cd.ind][i] > cd.v))); if (q < 0) free++; } console.log(`LINK: дней fng>${f} и oth90>1: ${all}, свободных от правил основы ${free}`); } }
const L = [];
for (const f of [55, 60, 65, 70, 72, 74, 75]) L.push([`fng>${f}, oth90>1, 5%`, ins(B, AS(f, 1, 0.05))]);
for (const o of [0, 0.5, 1.5, 2, 3]) L.push([`fng>70, oth90>${o}, 5%`, ins(B, AS(70, o, 0.05))]);
for (const f of [60, 65]) for (const o of [0.5, 2]) L.push([`fng>${f}, oth90>${o}, 5%`, ins(B, AS(f, o, 0.05))]);
for (const s of [0.02, 0.15, 0.2]) L.push([`fng>65, oth90>1, ${s * 100}%`, ins(B, AS(65, 1, s))]);
L.push(['перед фандингом #19: fng>70, oth90>1, 5%', ins(B, AS(70, 1, 0.05), 19)]);
L.push(['перед фандингом #19: fng>65, oth90>1, 5%', ins(B, AS(65, 1, 0.05), 19)]);
L.push(['ВСЕ монеты: fng>65, oth90>1, 5%', ins(B, AS(65, 1, 0.05, false))]);
L.push(['ВСЕ монеты: fng>70, oth90>1, 5%', ins(B, AS(70, 1, 0.05, false))]);
L.push(['A1 (широкая тихая ×1,5 у альтов)', A1]);
L.push(['A1 + fng>65, oth90>1, 5%', ins(A1, AS(65, 1, 0.05))]);
L.push(['A1 + fng>70, oth90>1, 5%', ins(A1, AS(70, 1, 0.05))]);
const out = [];
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
