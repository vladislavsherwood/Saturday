/* Финалисты по рынку деривативов на отборе, экзамене и 50 случайных. Запуск: node app/liq_final.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8')).rules, QC = JSON.parse(fs.readFileSync(__dirname + '/found/quiet-capit.json', 'utf8')).rules, CAP = QC[0];
const OI = (x, g) => ({ act: g, conds: [c('oidd30', '<', -x)] }), HOT = (x, f) => ({ act: f, conds: [c('fund30', '>', x)] });
const L = [{ tag: 'Тихая вершина (без капитуляции)', S: { base: 1, rules: [...A, QC[5]] } }, { tag: 'Тихая вершина + капитуляция', S: { base: 1, rules: QC } }];
for (const x of [24, 25, 26, 28, 30, 32]) for (const g of [1.25, 1.35, 1.5]) L.push({ tag: `OI −${x}% от макс. → ${Math.round((g - 1) * 100)}%`, S: { base: 1, rules: [CAP, OI(x, g), ...QC.slice(1)] } });
for (const x of [1.5, 2, 2.5, 3]) L.push({ tag: `фандинг > ${x}% → продать 5%`, S: { base: 1, rules: [...QC.slice(0, 5), HOT(x, -0.05), QC[5]] } });
for (const x of [25, 28]) for (const h of [2, 2.5]) L.push({ tag: `OI −${x}% → 35% и фандинг > ${h}% → продать 5%`, S: { base: 1, rules: [CAP, OI(x, 1.35), ...QC.slice(1, 5), HOT(h, -0.05), QC[5]] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  const base = rows[1];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med > base.sel.med, stable(r, base, 'ex') && r.ex.med > base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med];
  for (const r of rows) console.log(`${r.tag.padEnd(46)} ${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.pos}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}`);
  for (const t of ['Тихая вершина + капитуляция', 'OI −28% от макс. → 35%', 'OI −28% → 35% и фандинг > 2% → продать 5%']) { const r = rows.find((x) => x.tag === t); console.log(`\n${t}\n${report(r)}`); }
})();
