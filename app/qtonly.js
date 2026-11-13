/* Что будет, если оставить продажи только на тихой вершине (без продаж на страхе).
   Запуск: node app/qtonly.js <папка со страницами> */
const fs = require('fs');
const { lab, c, report } = require('./lab.js');
const A = JSON.parse(fs.readFileSync(__dirname + '/found/gentle-impulse.json', 'utf8')), [B, ST, WK, RB] = A.rules;
const QT = (f) => ({ act: -f, conds: [c('qt', '>', 0.5)] });
const L = [{ tag: 'ТЕКУЩАЯ: страх 30% / 16% + тихая вершина 10%', S: { base: 1, rules: [B, ST, WK, RB, QT(0.1)] } },
  { tag: 'стабильная без тихой вершины (только страх)', S: { base: 1, rules: [B, ST, WK, RB] } }];
for (const f of [0.05, 0.1, 0.25, 0.5, 1]) L.push({ tag: `только тихая вершина ${f * 100}% (покупки на панике и развороте остаются)`, S: { base: 1, rules: [B, RB, QT(f)] } });
L.push({ tag: 'только тихая вершина 10% + слабый страх 16% (без сильного)', S: { base: 1, rules: [B, WK, RB, QT(0.1)] } });
L.push({ tag: 'только тихая вершина 10% + сильный страх 30% (без слабого)', S: { base: 1, rules: [B, ST, RB, QT(0.1)] } });
(async () => {
  const lb = await lab(process.argv[2], { rnd: true }), rows = await lb.run(L); await lb.close();
  for (const r of rows) console.log(`${r.tag}\n${report(r)}`);
})();
