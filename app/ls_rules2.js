/* Лонги/шорты, раунд 2 в стратегии: отложенная покупка после выноса, паузы при толпе в шортах, растягивание покупок по дну.
   Запуск: node app/ls_rules2.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const { injLs } = require('./ls_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const [CAP, OI, ...REST] = B.rules;
const S = (rules, extra = []) => ({ ...B, rules: [CAP, ...rules, ...REST.slice(0, 7), ...extra, ...REST.slice(7)] });   // extra — перед продажами по фандингу/тихой вершине
const HOLD = (x) => ({ act: 1, conds: [...OI.conds, c('lsr', '<', x)] });
const L = [{ tag: 'B (сейчас)', S: B }];
for (const n of [20, 40]) for (const x of [95, 100]) for (const f of ['', 'f']) for (const g of [1.25, 1.5, 2]) {
  const D = { act: g, conds: [c(`dly${n}_${x}${f}`, '>', 0.5)] }, t = `отложенная: ${n} дн после выноса толпа вышла из шортов (> ${x / 100})${f ? ', первый день' : ', каждый день'} → ${Math.round((g - 1) * 100)}%`;
  L.push({ kind: 'add', tag: `+ ${t}`, S: S([D, OI]) });
  L.push({ kind: 'delay', tag: `вместо: при толпе в шортах ждать, потом ${t}`, S: S([HOLD(0.9), D, OI]) });
}
for (const x of [0.85, 0.9]) L.push({ kind: 'hold', tag: `вынос и толпа в шортах (< ${x}) → только взнос (без отложенной)`, S: S([HOLD(x), OI]) });
for (const th of [20, 24]) for (const g of [1.15, 1.25]) L.push({ kind: 'spread', tag: `растянуть: OI −${th}% и доля лонгов −10% за 7 дн → ${Math.round((g - 1) * 100)}% (после основного правила)`, S: S([OI, { act: g, conds: [c('oidd30', '<', -th), c('ls7', '<', -10)] }]) });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) { await lb.pages[g].evaluate(injLiq, LIQ); await lb.pages[g].evaluate(injLs); }
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med >= base.sel.med, stable(r, base, 'ex') && r.ex.med >= base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.hpos >= base.rnd.hpos && r.rnd.med >= base.rnd.med];
  const line = (r) => `${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(4)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')} ${r.tag}`;
  console.log('отбор медиана/худш.пол./половин+ | экзамен то же | 50 случ. медиана/половин+\n' + line(base));
  for (const k of ['add', 'delay', 'hold', 'spread']) { console.log(`\n[${k}]`); rows.filter((r) => r.kind === k).sort((a, b) => b.sel.med + b.ex.med + 3 * b.rnd.med - (a.sel.med + a.ex.med + 3 * a.rnd.med)).slice(0, 8).forEach((r) => console.log(line(r))); }
  fs.writeFileSync(process.argv[2] + '/ls_rules2.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: r.S, ok: ok(r) }))));
})();
