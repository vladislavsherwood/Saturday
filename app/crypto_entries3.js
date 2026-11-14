/* Точки входа, раунд 3: правило «разворот биткоина» (биткоин +20% за 30 дней → весь резерв) — по разбору самый неточный вход.
   Варианты: порог роста, доля резерва, подтверждение трендом (выше средней 200), запрет при жадности, запрет вблизи максимума.
   Всё поверх «страх < 10 → взнос и 25% резерва». Запуск: node app/crypto_entries3.js <папка> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8'));
const [PANIC, ST, WK, RB] = A.rules, QT = { act: -0.1, conds: [c('qt', '>', 0.5)] }, CAP = { act: 1.25, conds: [c('fng', '<', 10)] };
const mk = (rb) => ({ base: 1, rules: [CAP, PANIC, ST, WK, ...(rb ? [rb] : []), QT] });
const L = [{ tag: 'ТЕКУЩАЯ', S: { base: 1, rules: [PANIC, ST, WK, RB, QT] } }, { tag: 'текущая + страх < 10 → 25%', S: mk(RB) }, { tag: 'без разворота биткоина', S: mk(null) }];
for (const r of [15, 20, 25, 30]) for (const g of [1.5, 2]) L.push({ tag: `разворот: биткоин +${r}% за 30 дн → ${g >= 2 ? 'весь' : '50%'}`, S: mk({ act: g, conds: [c('btcr30', '>', r)] }) });
for (const [k, o, v, t] of [['btc200', '>', 1, 'и выше средней 200'], ['btc200', '<', 1, 'и ниже средней 200'], ['fng', '<', 70, 'и нет жадности (страх < 70)'], ['fng', '<', 60, 'и страх < 60'],
  ['btcath', '>', 20, 'и биткоин ниже максимума на 20%+'], ['btcath', '>', 35, 'и биткоин ниже максимума на 35%+'], ['sma50', '>', 1, 'и монета выше своей средней 50'], ['sma200', '<', 1, 'и монета ниже своей средней 200']])
  L.push({ tag: `разворот +20% ${t}`, S: mk({ act: 2, conds: [c('btcr30', '>', 20), c(k, o, v)] }) });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true }); const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med > base.sel.med, stable(r, base, 'ex') && r.ex.med > base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med];
  console.log('отбор медиана/худшая пол./половин+ | экзамен то же | 50 случайных медиана/худшая/половин+ | ✔');
  for (const r of rows) console.log(`${r.tag.padEnd(52)} ${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)}/${r.sel.hpos} | ${r.ex.med.toFixed(0).padStart(5)}/${r.ex.hworst.toFixed(0).padStart(4)}/${r.ex.hpos} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.worst.toFixed(0)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}`);
})();
