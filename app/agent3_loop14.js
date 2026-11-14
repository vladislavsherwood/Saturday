/* Агент 3, круг 14: осторожный шорт самой монеты — только слабой (ниже своей средней 200, бета > 1,2) и только на жадности рынка.
   Агент 1: шорт альтов на сигналах вершины ловит ликвидации в альтсезон (монеты после «тихой вершины» вырастали в разы). Гипотеза: слабая
   высокобетовая монета на жадности рынка — отстающая, у неё меньше шансов на взрывной рост, а падение в следующей панике глубже.
   Вход: жадность > 75 (или > 70) и монета < средней 200 (и бета180 > 1,2); выход: сигнал дна, разворот BTC или монета вернулась выше
   средней 200 (·1 / ·1,1). Размер 2/5/10% капитала монеты; проценты по займу 15% годовых. Ликвидации — на всех 181 монете при максимумах
   +20/+30% (и минимумах ниже). База — C4. Критерий: 0 ликвидаций в стрессе на всех группах + строгая проверка + доход > +0,03.
   Запуск: node app/agent3_loop14.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.C4), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
const c = A.c, BOT = [[c('usdt', '>', 1.07), c('othd', '<', 25)], [c('fng', '<', 10)], [c('oidd30', '<', -28)], [c('btcr30', '>', 20)]];
const liqs = (S, hs) => { let n = 0; const who = []; for (const g in G) for (const X of G[g]) { const l = A.edge(X, S, 0, 'full', false, hs).liq + A.edge(X, S, 1, 'full', false, hs).liq; if (l) { n++; who.push(X.name); } } return [n, who]; };
for (const fg of [70, 75]) for (const [bt, bc] of [['', []], [' и бета > 1,2', [c('beta180', '>', 1.2)]]]) for (const ex of [1.0, 1.1]) for (const size of [0.02, 0.05, 0.1]) {
  const S = { ...A.C4, short: { entry: [[c('fng', '>', fg), c('sma200', '<', 1), ...bc]], exit: [...BOT, [c('sma200', '>', ex)]], size, rate: 0.15 / 365 } };
  const r = A.ev(G, S, false), t = `шорт монеты ${size * 100}%: жадность > ${fg}, монета < средней 200${bt}; выход дно/разворот/монета > ${ex} средней`;
  const [l1] = liqs(S, 1), [l2, w2] = liqs(S, 1.2), [l3, w3] = liqs(S, 1.3);
  console.log(A.row(t, r, base) + ` | ликвидации: ${l1} / стресс +20% ${l2} / +30% ${l3} ${w3.slice(0, 8).join(',')}`);
  out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), liq: [l1, l2, l3], who: w3 });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
