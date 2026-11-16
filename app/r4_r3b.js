/* r4, круг 3 (финальная проверка): 100 новых и по монетам-мемам. Запуск: node r4_r3b.js */
const L = require('./r4_lib.js'), { P, Z, c } = L;
const split = (sm) => { const S = L.clone(); S.rules.push({ act: -sm, conds: [c('usdt', '<', 0.9), c('age', '>', 540), c('meme', '>', 0.5), c('beta180', '>', 0.9)] }); return S; };
const B = P.evc(L.S0, L.pol0, ['sel', 'ex', 'rnd', 'n100']);
for (const s of [0.08, 0.1, 0.15]) {
  const S = split(s); L.run(`мемы ${s * 100}%`, S, L.pol0, { n100: true });
  const R = P.evc(S, L.pol0, ['sel', 'ex', 'rnd', 'n100']);
  for (const g in R) R[g].forEach((x, i) => { const y = B[g][i]; if (x.seg === 'meme') console.log(`  ${g} ${x.name.padEnd(10)} вся ${y.f.toFixed(0)} → ${x.f.toFixed(0)} | 1-я ${y.h1.toFixed(1)} → ${x.h1.toFixed(1)} | 2-я ${y.h2.toFixed(1)} → ${x.h2.toFixed(1)}`); });
}
