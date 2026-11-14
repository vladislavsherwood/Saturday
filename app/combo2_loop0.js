/* Объединение 2, круг 0: сборщик combo2_sim.build воспроизводит правила основы и каждого агента (сравнение правил и итогов). */
const Z = require('./combo2_sim.js'); const { K } = Z; const fs = require('fs');
const J = (f) => JSON.parse(fs.readFileSync(__dirname + '/found/' + f, 'utf8'));
const same = (a, b) => JSON.stringify(a.rules) === JSON.stringify(b.rules);
const BB = require('./seg_big_sim.js');
const cases = [
  ['основа = combo-best', Z.build({}), Z.BASE],
  ['CM2 = seg_meme-best', Z.build({ cm2: true }), J('seg_meme-best.json')],
  ['A1+AS = seg_alt-best', Z.build({ a1: true, as: true }), J('seg_alt-best.json')],
  ['B65 = seg_big B65', Z.build({ b65: 'b' }), BB.B65()],
  ['список|B65 = seg_big LB65', Z.build({ b65: 'list' }), BB.LB65()],
  ['TA = ta-best', Z.build({ ta: true }), J('ta-best.json')],
];
for (const [t, a, b] of cases) {
  const ok = same(a, b);
  console.log(`${t}: правил ${a.rules.length} / ${b.rules.length}, ${ok ? 'совпадают' : 'РАЗЛИЧАЮТСЯ'}`);
  if (!ok) { const n = Math.max(a.rules.length, b.rules.length); for (let i = 0; i < n; i++) { const x = JSON.stringify(a.rules[i]), y = JSON.stringify(b.rules[i]); if (x !== y) { console.log('  #' + i, '\n   мой ', x, '\n   агент', y); break; } } }
}
