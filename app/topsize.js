/* Размер продажи у вершины (все пять рыночных маркеров, монета на 90-дневном максимуме) с шагом 0,5%.
   Выбор по 17 монетам отбора; экзамен и 50 случайных показывают, держится ли он.
   Запуск: node app/topsize.js <папка со страницами> <куда.json> */
const fs = require('fs');
const { lab, c, stable, sh, report } = require('./lab.js');
const CUR = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8')), [B, ST, WK, RB] = CUR.rules;
const L = [];
for (let v = 0; v <= 100.01; v += 0.5) L.push({ v: +v.toFixed(1), S: { base: 1, rules: v ? [B, { act: -v / 100, conds: [c('hi90', '>', 0.5), c('topm', '>', 4.5)] }, ST, WK, RB] : [B, ST, WK, RB] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true }), rows = await lb.run(L), base = rows[0];
  const sc = (s) => s.worst + s.hworst + s.med / 5;
  console.log('размер: отбор медиана/худшая/худш.половина | экзамен медиана/худшая/худш.половина | 50 случайных в плюсе/медиана/худшая | оценка отбора');
  for (const r of rows.filter((q) => q.v % 5 === 0)) console.log(`${String(r.v).padStart(5)}%: ${r.sel.med.toFixed(0).padStart(4)} / ${r.sel.worst.toFixed(0)} / ${r.sel.hworst.toFixed(0).padStart(3)} | ${r.ex.med.toFixed(0).padStart(4)} / ${r.ex.worst.toFixed(0)} / ${r.ex.hworst.toFixed(0).padStart(3)} | ${r.rnd.pos} / ${r.rnd.med.toFixed(0).padStart(4)} / ${r.rnd.worst.toFixed(0)} | ${sc(r.sel).toFixed(1)}`);
  const ok = rows.filter((r) => r.v && stable(r, base, 'sel') && r.sel.med >= base.sel.med), ok2 = ok.filter((r) => stable(r, base, 'ex') && r.ex.med >= base.ex.med), ok3 = ok2.filter((r) => r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med);
  const span = (a) => (a.length ? `${Math.min(...a.map((r) => r.v))}…${Math.max(...a.map((r) => r.v))}% (${a.length} значений)` : 'нет');
  console.log(`\nне хуже текущей на отборе: ${span(ok)}; и на экзамене: ${span(ok2)}; и на 50 случайных: ${span(ok3)}`);
  const best = rows.reduce((a, r) => (sc(r.sel) > sc(a.sel) ? r : a)), bestEx = rows.reduce((a, r) => (sc(r.ex) > sc(a.ex) ? r : a)), bestR = rows.reduce((a, r) => (r.rnd.med > a.rnd.med ? r : a));
  const plat = rows.filter((r) => sc(r.sel) >= sc(best.sel) - 2).map((r) => r.v);
  console.log(`лучший по отбору: ${best.v}% (зона «почти так же»: ${Math.min(...plat)}…${Math.max(...plat)}%); лучший по экзамену: ${bestEx.v}%; лучшая медиана на случайных: ${bestR.v}%`);
  const d = rows.slice(1).map((r, i) => Math.abs(r.all.med - rows[i].all.med)).sort((x, y) => x - y);
  console.log(`типичная разница медианы между соседними шагами: ${d[Math.floor(d.length / 2)].toFixed(1)} п.п.`);
  for (const r of [base, rows.find((q) => q.v === 50), best]) console.log(`\n${r.v}%\n${report(r)}`);
  fs.writeFileSync(process.argv[3], JSON.stringify(rows.map((r) => [r.v, r.sel, r.ex, r.rnd, r.all])));
  await lb.close();
})();
