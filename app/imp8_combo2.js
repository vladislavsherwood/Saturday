/* imp8: то же упрощение (simplifyC) поверх combo2-best: совпадает ли по монетам на всех группах. Запуск: node app/imp8_combo2.js */
const I = require('./imp8_sim.js'); const Z = require('./combo2_sim.js'); const fs = require('fs'); const { K } = I;
const C2 = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const S0 = { base: C2.base, rules: C2.rules }, S1 = I.simplifyC(S0);
const G = Z.load(['sel', 'ex', 'rnd', 'n100']);
const b = K.ev(G, S0, false), r = K.ev(G, S1, false);
console.log(`combo2-best: ${S0.rules.length} правил → упрощённая ${S1.rules.length}; доход ${K.d(r, b).toFixed(4)}, строгая ${K.passes(r, b) ? '✔' : '· ' + K.why(r, b)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) { const d = r[g].e.map((v, i) => Math.abs(Math.log1p(v / 100) - Math.log1p(b[g].e[i] / 100))); console.log(`  ${g}: медиана ${b[g].med.toFixed(0)} → ${r[g].med.toFixed(0)}%, макс. разница по монете ${(100 * Math.max(...d)).toFixed(4)}%`); }
fs.writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp8_c2.json', JSON.stringify({ S1 }));
