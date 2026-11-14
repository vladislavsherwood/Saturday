/* Агент «АЛЬТЫ», круг 8: сборка A1 (широкая тихая вершина ×k у альтов) + AS (альтсезон → продать альт s% в свободный день) и выбор.
   Гипотеза (заранее): AS вернула XMR 2-ю половину (экзамен хп 14,6 у A1 ×1,5 + AS), поэтому существует сочетание с меньшим A1 (×1,25),
   которое проходит строгую проверку внутри альтов полностью (в том числе VCNT на 50 случайных) и сохраняет ≥ 80% дохода A1 ×1,5 + AS.
   Критерий выбора (заранее): среди проходящих строгую внутри альтов и на всей выборке — наибольший доход альтов, середина плато по обоим
   размерам; 100 новых — только проверка (медиана альтов, монеты и половины в плюсе не хуже основы).
   Запуск: node app/seg_alt_loop8.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c, K } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const ALT = c('isalt', '>', 0.5);
const up = (S, qs, k, extra) => (k === 1 ? S : { ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...extra] }, r] : [r])) });
const AS = (S, f, o, s) => (s === 0 ? S : { ...S, rules: [...S.rules, { act: -s, conds: [ALT, c('fng', '>', f), c('oth90', '>', o)] }] });
const mk = (k, f, s, all = false) => AS(up(B, all ? [21, 22, 23, 24] : [23, 24], k, [ALT]), f, 1, s);
const out = [], res = [];
for (const k of [1, 1.25, 1.5, 2]) for (const f of [60, 65, 70]) for (const s of [0, 0.05, 0.1, 0.15]) {
  if (s === 0 && f !== 65) continue; if (k === 1 && s === 0) continue;
  const t = `A1 ×${k} + AS жадность>${f} ${s * 100}%`, S = mk(k, f, s), r = Q.evs(G, S);
  const sa = Q.strict(r, rb, 'alt'), sall = Q.strict(r, rb, 'all'), d = Q.inc(r, 'alt') - Q.inc(rb, 'alt');
  res.push({ t, k, f, s, d, sa, sall, n: r.n100.alt, dm: Q.GR.map((g) => r[g].alt.med - rb[g].alt.med) });
  console.log(`${sa.length || sall.length ? '·' : '✔'} альты ${d >= 0 ? '+' : ''}${d.toFixed(3)} | Δмед ${res.at(-1).dm.map((x) => x.toFixed(0)).join('/')} | 100н альты ${r.n100.alt.med.toFixed(0)} плюс ${r.n100.alt.pos} пол ${r.n100.alt.hpos} | ${sa.concat(sall.filter((x) => !sa.includes(x))).join(',') || 'строгая ✔'} | ${t}`);
  out.push({ t, ...Q.pack(r, rb) });
}
// широкая и узкая вместе (×1,25) + AS
for (const s of [0.05, 0.1]) { const t = `A1 вся тихая ×1.25 + AS жадность>65 ${s * 100}%`, r = Q.evs(G, mk(1.25, 65, s, true)); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
console.log(`\nоснова: 100н альты ${rb.n100.alt.med.toFixed(0)} плюс ${rb.n100.alt.pos} пол ${rb.n100.alt.hpos}`);
// метрики дна/вершин по альтам для основы и двух кандидатов
const AL = ['sel', 'ex', 'rnd'].flatMap((g) => G[g].filter(Q.isAlt));
for (const [t, S] of [['основа', B], ['A1 ×1,25 + AS 65 10%', mk(1.25, 65, 0.1)], ['A1 ×1,5 + AS 65 10%', mk(1.5, 65, 0.1)], ['A1 ×1,25 + AS 65 5%', mk(1.25, 65, 0.05)]]) console.log(`метрики альтов, ${t}: ${K.fmtM(K.metrics(AL, S))}`);
fs.writeFileSync(process.argv[2], JSON.stringify({ out, res }));
