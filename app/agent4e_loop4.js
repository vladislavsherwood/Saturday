/* Агент 4E, круг 4: ДОПОЛНИТЕЛЬНЫЙ путь возврата в рынок на новых данных (порог «BTC +20%» остаётся как есть).
   Сигналы-кандидаты (из кругов 1–3): восстановление лент хешрейта (7…30-й день вверх после капитуляции майнеров), падение доходностей
   10 лет и доллара за 90 дней, приток стейблкоинов, «BTC +15% за 30 дней и приток стейблкоинов», низкий фандинг BTC.
   Покупка 25/50/100% резерва; место правила: сразу после разворота BTC (перед продажами) или в конце (только если нет продаж).
   Критерий (заранее): доход > +0,05 к W25 на 2 соседних порогах сигнала и 2 размерах, строгая проверка пройдена; 100 новых не хуже.
   Запуск: node app/agent4e_loop4.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const G = E.groups(['sel', 'ex', 'rnd']), base = E.ev(G, E.W25, false);
const R = E.W25.rules, i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30');
const ins = (rule, pos) => ({ ...E.W25, rules: pos === 'после разворота' ? [...R.slice(0, i13 + 1), rule, ...R.slice(i13 + 1)] : [...R, rule] });
const SIG = {
  'ленты хешрейта вверх 7…30 дн.': [c('hribup', '>', 6), c('hribup', '<', 31)],
  'ленты хешрейта вверх 14…30 дн.': [c('hribup', '>', 13), c('hribup', '<', 31)],
  'ленты хешрейта вверх 7…60 дн.': [c('hribup', '>', 6), c('hribup', '<', 61)],
  'доходность 10л за 90д < −0,5': [c('y10d90', '<', -0.5)],
  'доходность 10л за 90д < −0,75': [c('y10d90', '<', -0.75)],
  'доллар за 90д < −3%': [c('dxy90', '<', -3)],
  'доллар за 90д < −4%': [c('dxy90', '<', -4)],
  'стейблкоины за 30д > 3%': [c('stab30', '>', 3)],
  'стейблкоины за 30д > 5%': [c('stab30', '>', 5)],
  'BTC +15% за 30д и стейблкоины > 1%': [c('btcr30', '>', 15), c('stab30', '>', 1)],
  'BTC +15% за 30д и стейблкоины > 2%': [c('btcr30', '>', 15), c('stab30', '>', 2)],
  'BTC +12% за 30д и стейблкоины > 2%': [c('btcr30', '>', 12), c('stab30', '>', 2)],
  'фандинг BTC 30д < 0,2%': [c('fund30', '<', 0.2)],
  'фандинг BTC 30д < 0%': [c('fund30', '<', 0)],
  'фандинг альтов 30д < 0 и BTC +10%': [c('afund30', '<', 0), c('btcr30', '>', 10)],
};
console.log(E.HDR); console.log(E.show('W25', base, base));
const rows = [];
for (const pos of ['после разворота', 'в конце']) for (const [nm, conds] of Object.entries(SIG)) {
  const line = [];
  for (const a of [1.25, 1.5, 2]) { const r = E.ev(G, ins({ act: a, conds }, pos), false), d = E.d(r, base); rows.push({ pos, nm, a, d, pass: E.passes(r, base), why: E.why(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med }); line.push(`${a}:${d >= 0 ? '+' : ''}${d.toFixed(3)}${E.passes(r, base) ? '✔' : ' '}`); }
  console.log(`${pos.padEnd(16)} ${nm.padEnd(36)} ${line.join('  ')}`);
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop4.json', JSON.stringify(rows));
const best = rows.filter((r) => r.pass).sort((x, y) => y.d - x.d).slice(0, 6);
console.log('\nлучшие со строгой проверкой:'); for (const b of best) console.log(`  ${b.pos} | ${b.nm} → ${b.a}: ${b.d.toFixed(3)} (${b.sel.toFixed(0)}/${b.ex.toFixed(0)}/${b.rnd.toFixed(0)})`);
