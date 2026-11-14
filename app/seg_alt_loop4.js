/* Агент «АЛЬТЫ», круг 4: продажи альта в собственном пампе и в альтсезон (новые правила продажи только для альтов, в конце списка —
   срабатывают лишь в дни без других сигналов).
   Гипотеза (заранее): основа продаёт альт на его пампе только в медвежьем рынке BTC (#26–27: btcath > 20 и up90 > 300 → 10%); в бычьем
   рынке и в альтсезон альт в пампе не продаётся ничем, кроме тихой вершины, — «продали слишком поздно». Варианты:
   (a) памп альта без условия на BTC: up90 > 200/300/500 → продать 5/10/20%;
   (b) альтсезон: жадность > 70/75/80 и доля альтов за 90 дн растёт (oth90 > 1) → продать альт 3/5/10%;
   (c) после пампа: монета ×10 за год (pump365 > 10) и уже −30/−50% от максимума 90 дней → продать 5/10%.
   Критерий — общий для альтов (знак на четырёх группах, строгая внутри альтов).
   Запуск: node app/seg_alt_loop4.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const ALT = c('isalt', '>', 0.5);
const add = (S, act, conds) => ({ ...S, rules: [...S.rules, { act, conds: [ALT, ...conds] }] });
const L = [];
for (const u of [200, 300, 500]) for (const s of [0.05, 0.1, 0.2]) L.push([`(a) памп альта up90>${u} → ${s * 100}% (любой рынок)`, add(B, -s, [c('up90', '>', u)])]);
for (const u of [300]) for (const s of [0.1]) L.push([`(a') памп альта up90>${u} и BTC у максимума (btcath<20) → ${s * 100}%`, add(B, -s, [c('up90', '>', u), c('btcath', '<', 20)])]);
for (const f of [70, 75, 80]) for (const s of [0.03, 0.05, 0.1]) L.push([`(b) альтсезон fng>${f} и oth90>1 → ${s * 100}%`, add(B, -s, [c('fng', '>', f), c('oth90', '>', 1)])]);
for (const f of [75, 80]) for (const s of [0.05]) L.push([`(b') жадность fng>${f} (без доли альтов) → ${s * 100}%`, add(B, -s, [c('fng', '>', f)])]);
for (const d of [30, 50]) for (const s of [0.05, 0.1]) L.push([`(c) после пампа ×10 за год, −${d}% от 90-дн. макс → ${s * 100}%`, add(B, -s, [c('pump365', '>', 10), c('ddm90', '>', d)])]);
for (const d of [30, 50]) L.push([`(c') после пампа ×5 за год, −${d}% → 10%`, add(B, -0.1, [c('pump365', '>', 5), c('ddm90', '>', d)])]);
const out = [];
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
