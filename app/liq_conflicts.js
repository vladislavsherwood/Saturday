/* Что делать в дни конфликтов правил «Тихая вершина + ликвидации»:
   x — паника в стейблах и сильный страх (< 40) одновременно; y — паника и умеренный страх (40–52);
   z — разворот биткоина в дни продажи на страхе; w — разворот биткоина при перегретом фандинге.
   Запуск: node app/liq_conflicts.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const Q = JSON.parse(fs.readFileSync(__dirname + '/found/quiet-liq.json', 'utf8'));
const [CAP, OI, PANIC, ST, WK, RB, HOT, QT] = Q.rules;
const lab_ = (a) => (a === 1 ? 'взнос' : a > 1 ? `купить ${a >= 2 ? 'весь' : Math.round((a - 1) * 100) + '%'}` : `продать ${Math.round(-a * 100)}%`);
const fear = (v) => [c('fng', '<', v), c('usdtd', '<', 7.6)];
const L = [{ tag: 'ТЕКУЩАЯ', S: Q }];
for (const x of [1.5, 1.25, 1, -0.16, -0.3]) for (const y of [1.5, 1.25, 1, -0.16]) for (const z of [null, 1, 1.5, 2]) for (const w of [2, -0.05]) {
  const rules = [CAP, OI, { act: x, conds: [...PANIC.conds, ...fear(40)] }, { act: y, conds: [...PANIC.conds, ...fear(52)] }];
  if (z !== null) rules.push({ act: z, conds: [...RB.conds, ...fear(52)] });
  rules.push({ act: w, conds: [...RB.conds, ...HOT.conds] }, PANIC, ST, WK, RB, HOT, QT);
  L.push({ tag: `паника+страх<40: ${lab_(x)}; паника+страх 40–52: ${lab_(y)}; разворот в страх: ${z === null ? 'продажа (как сейчас)' : lab_(z)}; разворот+фандинг: ${lab_(w)}`, x, y, z, w, S: { base: 1, rules } });
}
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = []; for (let i = 0; i < L.length; i += 80) rows.push(...(await lb.run(L.slice(i, i + 80))));
  await lb.close();
  const base = rows[0];
  const line = (r) => `${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.worst.toFixed(0)}/${r.rnd.hpos}  ${r.tag}`;
  console.log('отбор медиана/худш.пол./половин+ | экзамен то же | 50 случ. медиана/худшая/половин+\n' + line(base));
  // граница: нет варианта, который лучше и по доходу (сумма лог-медиан), и по устойчивости (сумма худших половин)
  const inc = (r) => Math.log1p(r.sel.med / 100) + Math.log1p(r.ex.med / 100) + Math.log1p(r.rnd.med / 100), rob = (r) => r.sel.hworst + r.ex.hworst + 3 * (r.sel.hpos + r.ex.hpos + r.rnd.hpos);
  const front = rows.filter((r) => !rows.some((q) => q !== r && inc(q) >= inc(r) && rob(q) >= rob(r) && (inc(q) > inc(r) || rob(q) > rob(r)))).sort((a, b) => inc(a) - inc(b));
  console.log(`\n--- лучшие компромиссы доход/устойчивость (${front.length}) ---`); front.forEach((r) => console.log(line(r)));
  const dom = rows.filter((r) => r !== base && stable(r, base, 'sel') && stable(r, base, 'ex') && r.sel.med >= base.sel.med && r.ex.med >= base.ex.med && r.rnd.med >= base.rnd.med && r.rnd.hpos >= base.rnd.hpos);
  console.log(`\n--- не хуже текущей во всём: ${dom.length} ---`); dom.sort((a, b) => inc(b) - inc(a)).slice(0, 10).forEach((r) => console.log(line(r)));
  for (const k of ['x', 'y', 'z', 'w']) { const g = {}; rows.slice(1).forEach((r) => { const key = r[k] === null ? 'как сейчас' : lab_(r[k]); (g[key] = g[key] || []).push(r); });
    console.log(`\nвлияние ${k}: ` + Object.entries(g).map(([kk, v]) => `${kk}: доход ${(v.reduce((s, r) => s + inc(r), 0) / v.length).toFixed(2)}, устойч. ${(v.reduce((s, r) => s + rob(r), 0) / v.length).toFixed(0)}`).join(' | ')); }
  console.log(`\nтекущая: доход ${inc(base).toFixed(2)}, устойч. ${rob(base).toFixed(0)}`);
  fs.writeFileSync(process.argv[2] + '/conflicts.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: r.S, sel: r.sel, ex: r.ex, rnd: r.rnd }))));
})();
