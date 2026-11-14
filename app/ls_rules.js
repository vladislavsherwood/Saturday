/* Лонги/шорты как поправка к правилу «волна ликвидаций» в основной стратегии. Запуск: node app/ls_rules.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const OI = B.rules[1];
const withOI = (rules) => ({ ...B, rules: [B.rules[0], ...rules, ...B.rules.slice(2)] });
const L = [{ tag: 'B (сейчас): OI −28% → 50% резерва', S: B }];
for (const x of [0.85, 0.9, 0.95]) L.push({ tag: `OI −28% только если толпа НЕ в шортах (лонги/шорты к средней > ${x})`, S: withOI([{ ...OI, conds: [...OI.conds, c('lsr', '>', x)] }]) });
for (const x of [1.05, 1.1]) L.push({ tag: `OI −28% только если крупные НЕ лонгуют сильнее толпы (< ${x})`, S: withOI([{ ...OI, conds: [...OI.conds, c('div', '<', x)] }]) });
for (const th of [24, 20]) for (const x of [0.9, 0.95]) L.push({ tag: `порог мягче: OI −${th}% и толпа не в шортах (> ${x})`, S: withOI([{ ...OI, conds: [c('oidd30', '<', -th), c('lsr', '>', x)] }]) });
for (const th of [24, 20]) L.push({ tag: `добавить: OI −${th}% и доля лонгов −10% за 7 дней → 50%`, S: withOI([OI, { act: 1.5, conds: [c('oidd30', '<', -th), c('ls7', '<', -10)] }]) });
L.push({ tag: 'OI −28% и толпа в шортах → вместо покупки только взнос (ждём)', S: withOI([{ act: 1, conds: [...OI.conds, c('lsr', '<', 0.9)] }, OI]) });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med >= base.sel.med, stable(r, base, 'ex') && r.ex.med >= base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.med >= base.rnd.med];
  for (const r of rows) console.log(`${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')} ${r.tag}`);
})();
