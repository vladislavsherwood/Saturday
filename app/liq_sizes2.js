/* B: продажа на тихой вершине 10…50% и докупка на ликвидациях 35…100%, по отдельности и вместе. Запуск: node app/liq_sizes2.js <папка> */
const fs = require('fs');
const { lab, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const QI = B.rules.length - 1, OII = 1;
const mk = (qt, oi) => ({ base: 1, rules: B.rules.map((r, i) => (i === QI ? { ...r, act: -qt / 100 } : i === OII ? { ...r, act: 1 + oi / 100 } : r)) });
const L = [];
for (const qt of [10, 15, 20, 25, 30, 35, 40, 50]) for (const oi of [35, 50, 75, 100]) L.push({ tag: `тихая вершина: продать ${qt}%; ликвидации: купить ${oi}%`, qt, oi, S: mk(qt, oi) });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const ok = (r) => stable(r, base, 'sel') && stable(r, base, 'ex') && r.rnd.hpos >= base.rnd.hpos && r.rnd.pos >= base.rnd.pos;
  for (const r of rows) console.log(`${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.worst.toFixed(0)}/${r.rnd.pos}/${r.rnd.hpos} ${ok(r) ? '✔' : '✘'} ${r.tag}`);
  for (const t of ['тихая вершина: продать 20%; ликвидации: купить 35%', 'тихая вершина: продать 30%; ликвидации: купить 35%']) { const r = rows.find((x) => x.tag === t); console.log(`\n${t}\n${report(r)}`); }
  fs.writeFileSync(process.argv[2] + '/sizes2.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: r.S }))));
})();
