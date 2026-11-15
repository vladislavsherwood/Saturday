/* tune1: краткая таблица развёрток из scratchpad/tune1/<файл>.json (значение: доход всего/крупные/альты/мемы, число нарушений строгой, ✔). */
const fs = require('fs'); const f = process.argv[2];
const R = JSON.parse(fs.readFileSync(f, 'utf8'));
for (const [name, L] of Object.entries(R)) {
  console.log('## ' + name);
  for (const x of L) { const nst = Object.values(x.st).reduce((t, v) => t + v.length, 0); console.log(`${String(x.v).padStart(7)} ${x.inc.all >= 0 ? '+' : ''}${x.inc.all.toFixed(3)}  ${x.inc.big.toFixed(3)} ${x.inc.alt.toFixed(3)} ${x.inc.meme.toFixed(3)}  ${x.ok ? '✔' : '·' + nst}  ${x.meds}`); }
}
