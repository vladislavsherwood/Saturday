/* Что будет, если в дни без сигналов вообще не покупать (взнос целиком копится в резерве и тратится только по сигналам стратегии).
   Запуск: node app/no_base.js <папка> */
const fs = require('fs');
const { lab, c, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const ALL = [c('age', '>', -1)];
const onlyRule = { ...B, rules: B.rules.map((r) => (r.act === 1 ? { ...r, act: 0 } : r)) };   // правило «только взнос» тоже без покупки
const L = [{ tag: 'B: обычный взнос каждый день без сигналов', S: B }, { tag: 'взнос ×0,5 в дни без сигналов', S: { ...B, mods: [{ mult: 0.5, conds: ALL }] } },
  { tag: 'без обычного взноса: в дни без сигналов не покупаем', S: { ...B, mods: [{ mult: 0, conds: ALL }] } },
  { tag: 'без обычного взноса и без «только взнос» на развороте', S: { ...onlyRule, mods: [{ mult: 0, conds: ALL }] } }];
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  for (const r of rows) console.log(`${r.tag}\n${report(r)}\n`);
})();
