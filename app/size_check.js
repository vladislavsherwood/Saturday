/* Новые размеры покупок на сигналах (из lev_size.py) без плеча: не портят ли стратегию на отборе, экзамене и 50 случайных. */
const fs = require('fs');
const { lab, report } = require('./lab.js');
const { injLiq } = require('./liq_inject.js');
const LIQ = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(__dirname + '/found/main-crypto.json', 'utf8'));
const set = (acts) => ({ ...B, rules: B.rules.map((r, i) => (acts[i] != null ? { ...r, act: acts[i] } : r)) });
const L = [{ tag: 'B (сейчас)', S: B },
  { tag: 'паника ×1,5 (38/75/75%)', S: set({ 2: 1.375, 3: 1.75, 6: 1.75 }) },
  { tag: 'дно 25%, паника ×1,5, разворот 50% (размеры лучшей схемы с плечом)', S: set({ 0: 1.25, 1: 1.25, 2: 1.375, 3: 1.75, 6: 1.75, 5: 1.5, 9: 1.5 }) }];
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  for (const g in lb.pages) await lb.pages[g].evaluate(injLiq, LIQ);
  const rows = await lb.run(L); await lb.close();
  for (const r of rows) console.log(`${r.tag}\n${report(r)}\n`);
})();
