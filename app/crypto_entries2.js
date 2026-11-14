/* Точки входа, раунд 2: плато вокруг двух прошедших идей (капитуляция по страху, маркеры дна) и их сочетание.
   Запуск: node app/crypto_entries2.js <папка со страницами> */
const fs = require('fs');
const { lab, c, stable, report } = require('./lab.js');
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8'));
const [PANIC, ST, WK, RB] = A.rules, QT = { act: -0.1, conds: [c('qt', '>', 0.5)] };
const L = [{ tag: 'ТЕКУЩАЯ', S: { base: 1, rules: [PANIC, ST, WK, RB, QT] } }];
const pct = (g) => (g >= 2 ? 'весь резерв' : Math.round((g - 1) * 100) + '% резерва');
const cap = (f, g) => ({ act: g, conds: [c('fng', '<', f)] }), bot = (k, g) => ({ act: g, conds: [c('botm', '>', k - 0.5)] });
for (const f of [6, 8, 10, 12, 14]) for (const g of [1.15, 1.25, 1.35, 1.5, 1.75]) L.push({ kind: 'capit', tag: `страх < ${f} → взнос и ${pct(g)}`, S: { base: 1, rules: [cap(f, g), PANIC, ST, WK, RB, QT] } });
for (const k of [4, 5]) for (const g of [1.5, 1.75, 2]) L.push({ kind: 'bottom', tag: `маркеров дна ≥ ${k} → взнос и ${pct(g)}`, S: { base: 1, rules: [bot(k, g), PANIC, ST, WK, RB, QT] } });
for (const f of [8, 10, 12]) for (const g of [1.25, 1.5]) for (const k of [4]) for (const b of [1.75, 2])
  L.push({ kind: 'combo', tag: `маркеров дна ≥ ${k} → ${pct(b)}; страх < ${f} → ${pct(g)}`, S: { base: 1, rules: [bot(k, b), cap(f, g), PANIC, ST, WK, RB, QT] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true });
  const rows = await lb.run(L); await lb.close();
  const base = rows[0];
  console.log(`${base.tag}\n${report(base)}`);
  const ok = (r) => [stable(r, base, 'sel') && r.sel.med > base.sel.med, stable(r, base, 'ex') && r.ex.med > base.ex.med, r.rnd.pos >= base.rnd.pos && r.rnd.worst >= base.rnd.worst - 0.5 && r.rnd.med >= base.rnd.med];
  console.log('\nкраткая таблица: отбор медиана/худшая половина | экзамен медиана/худшая половина | 50 случайных медиана/в плюсе половин | ✔ отбор экзамен случайные');
  for (const r of rows) console.log(`${r.tag.padEnd(60)} ${r.sel.med.toFixed(0).padStart(5)}/${r.sel.hworst.toFixed(0).padStart(4)} | ${r.ex.med.toFixed(0).padStart(5)}/${r.ex.hworst.toFixed(0).padStart(4)} | ${r.rnd.med.toFixed(0).padStart(4)}/${r.rnd.hpos} ${ok(r).map((x) => (x ? '✔' : '·')).join('')}`);
  fs.writeFileSync(process.argv[2] + '/entries2.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: L.find((x) => x.tag === r.tag).S, ok: ok(r) }))));
})();
