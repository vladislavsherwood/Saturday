/* Агент 4E, круг 7: продажа на росте OI ETH — почему не проходит строгую проверку и как это исправить без подгонки.
   H7a: проигрывают отдельные монеты/половины (разбор по монетам: кто теряет больше 5 п.п.).
   H7b: рост OI бывает и при наборе шортов (тогда это топливо для роста). Требовать, чтобы плечи набирались в лонг: фандинг ETH за 7/30 дней > 0,
        лонги/шорты ETH к средней > 1; или «жадность > 50»; или BTC у максимума (< 20/30% от него).
   Критерий (заранее): плато ≥ +0,1 по порогу 35/40/50 и размеру 25/40%, строгая проверка пройдена (или 1 пункт), 100 новых не хуже W25.
   Запуск: node app/agent4e_loop7.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const G = E.groups(['sel', 'ex', 'rnd', 'n100']), base = E.ev(G, E.W25, false);
const R = E.W25.rules, i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30');
const after = (rules) => ({ ...E.W25, rules: [...R.slice(0, i13 + 1), ...rules, ...R.slice(i13 + 1)] });
// H7a: по монетам
const S0 = after([{ act: -0.25, conds: [c('eoic30', '>', 40)] }]), r0 = E.ev(G, S0, false);
console.log('H7a: «OI ETH за 30д > 40% → продать 25%» (после разворота) — монеты, где разница с W25 больше 5 п.п. (полная история / половины)');
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
  const f = (S, p) => E.E(X, S, p), d = f(S0, 'full') - f(E.W25, 'full'), h1 = f(S0, 'h1') - f(E.W25, 'h1'), h2 = f(S0, 'h2') - f(E.W25, 'h2');
  if (Math.abs(d) > 5 || Math.abs(h2) > 5 || Math.abs(h1) > 5) console.log(`  ${g} ${X.name.padEnd(8)} ${f(E.W25, 'full').toFixed(0).padStart(6)} → ${f(S0, 'full').toFixed(0).padStart(6)} | 1-я пол. ${f(E.W25, 'h1').toFixed(0)} → ${f(S0, 'h1').toFixed(0)} | 2-я пол. ${f(E.W25, 'h2').toFixed(0)} → ${f(S0, 'h2').toFixed(0)}`);
}
console.log('\nH7b: рост OI ETH + признак, что плечи набираются в лонг; пороги OI 35 / 40 / 50, размер 25% / 40%');
const F = { 'нет': [], 'фандинг ETH 7д > 0': [c('efund7', '>', 0)], 'фандинг ETH 30д > 0,3%': [c('efund30', '>', 0.3)], 'фандинг ETH 30д > 0,6%': [c('efund30', '>', 0.6)],
  'лонги/шорты ETH к ср. > 1': [c('elsr', '>', 1)], 'жадность > 50': [c('fng', '>', 50)], 'жадность > 60': [c('fng', '>', 60)], 'BTC < 20% от макс.': [c('btcath', '<', 20)], 'BTC < 30% от макс.': [c('btcath', '<', 30)], 'монета за 30д > 0': [c('ret30', '>', 0)] };
const rows = [];
for (const [nm, ex] of Object.entries(F)) for (const a of [0.25, 0.4]) {
  const line = [];
  for (const v of [35, 40, 50]) { const r = E.ev(G, after([{ act: -a, conds: [c('eoic30', '>', v), ...ex] }]), false), d = E.d(r, base), w = E.why(r, base); rows.push({ nm, a, v, d, pass: E.passes(r, base), why: w, n100: r.n100.med }); line.push(`${d >= 0 ? '+' : ''}${d.toFixed(2)}${E.passes(r, base) ? '✔' : w.split('; ').length === 1 ? '~' : ' '} 100н ${r.n100.med.toFixed(0)}`); }
  console.log(`  ${nm.padEnd(26)} ${a * 100}% | ${line.join(' | ')}`);
}
const top = rows.filter((r) => r.d > 0.05).sort((x, y) => (y.pass - x.pass) || (x.why.split(';').length - y.why.split(';').length) || y.d - x.d).slice(0, 8);
console.log('\nлучшие:'); for (const t of top) console.log(`  ${t.nm} | OI > ${t.v}% → ${t.a * 100}%: ${t.d.toFixed(3)} 100н ${t.n100.toFixed(0)} | ${t.pass ? '✔' : t.why}`);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop7.json', JSON.stringify(rows));
