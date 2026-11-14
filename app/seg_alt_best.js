/* Агент «АЛЬТЫ», итог: сохраняет found/seg_alt-best.json (правила выбора, сильного и осторожного вариантов, цифры быстрого оценщика и браузерного
   стенда по альтам/остальным/всем) и found/seg_alt-best-margin.json (пять портфелей из seg_alt_margin.py).
   Запуск: node app/seg_alt_best.js <seg_alt_cands.lab.json> <seg_alt_margin.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { V } = require('./seg_alt_cands.js');
const [labF, marF] = process.argv.slice(2);
const LAB = JSON.parse(fs.readFileSync(labF, 'utf8')), MAR = JSON.parse(fs.readFileSync(marF, 'utf8'));
const G = Q.load(); Q.addAltFlag(G);
const B0 = 'основа (combo-best)', rb = Q.evs(G, V[B0]);
const res = {};
for (const nm in V) {
  const r = nm === B0 ? rb : Q.evs(G, V[nm]), o = { fast: {}, lab: {} };
  for (const g of Q.GR) { o.fast[g] = r[g]; o.lab[g] = LAB[nm][g]; }
  if (nm !== B0) {
    o.fast.vsBase = { incomeAlt: Q.inc(r, 'alt') - Q.inc(rb, 'alt'), incomeOth: Q.inc(r, 'oth') - Q.inc(rb, 'oth'), incomeAll: Q.inc(r, 'all') - Q.inc(rb, 'all'), strictAlt: Q.strict(r, rb, 'alt'), strictOth: Q.strict(r, rb, 'oth'), strictAll: Q.strict(r, rb, 'all'),
      betterWorseAlt: Object.fromEntries(Q.GR.map((g) => [g, Q.bw(r, rb, g, 'alt')])) };
    const lb = LAB[nm], l0 = LAB[B0];
    o.lab.vsBase = { incomeAlt: Q.inc(lb, 'alt') - Q.inc(l0, 'alt'), strictAlt: Q.strict(lb, l0, 'alt'), strictAll: Q.strict(lb, l0, 'all') };
    o.lab.worseCoins = Object.fromEntries(Q.GR.map((g) => [g, lb.coins[g].map((x, i) => [x.name, +(x.full - l0.coins[g][i].full).toFixed(1)]).filter((x) => x[1] < -0.5).sort((a, b) => a[1] - b[1])]));
  }
  res[nm] = o;
  console.log(Q.row(nm, r, nm === B0 ? null : rb));
}
const human = [
  'Всё из combo-best.json (F + C1.25 + C6 поверх «K3 + отложенная» + W25) без изменений для крупных монет (BTC, ETH, BNB, XRP, SOL, TRX, ADA), мемов и стейблов.',
  'Альт = любая монета, кроме крупных (BTC, ETH, BNB, XRP, SOL, TRX, ADA), мемов (DOGE, SHIB, PEPE, WIF, BONK, FLOKI, PUMP, FARTCOIN, ELON, NPC, PENGU, TIBBIR, MOG, APEPE, BANANAS31, JELLYJELLY, KIMCHI и подобные) и стейблов.',
  'A1 — широкая тихая вершина у альтов ×1,25: BTC < 15% от максимума и доля альтов за 90 дней > +1 п.п. → продать 62,5% альта (было 50%), у альта, отставшего от BTC за 180 дней больше чем на 15%, — 78% (было 62,5%). Узкая тихая вершина без изменений.',
  'AS — альтсезон: альт, жадность > 65 и доля альтов за 90 дней > +1 п.п., и в этот день не сработало ни одно другое правило (нет страха, паники, разворота BTC, перегретого фандинга, тихой вершины, пампа, возврата) → продать 10% альта (правило в конце списка).'
];
const best = {
  name: 'АЛЬТ = combo-best + A1 ×1,25 + AS (жадность > 65, доля альтов +1 п.п., 10%) — правила только для альтов',
  base: V['ВЫБОР: A1 ×1,25 + AS 65/1/10%'].base, rules: V['ВЫБОР: A1 ×1,25 + AS 65/1/10%'].rules, rules_human: human,
  alt_flag: { indicator: 'isalt', definition: '1 у альта, 0 у крупной монеты, мема или стейбла (по тикеру, списки ниже); новый индикатор для приложения', large: Q.LARGE, meme: Q.MEME, stable: Q.STABLE },
  stronger: { name: 'A1 ×1,5 + AS 10% (доход альтов выше, строгая внутри альтов ломается на VCNT: +1% → −0,2%)', rules: V['СИЛЬНЕЕ: A1 ×1,5 + AS 65/1/10%'].rules },
  cautious: { name: 'только AS 10% (одно новое правило, строгая ✔)', rules: V['ОСТОРОЖНО: только AS 65/1/10%'].rules },
  results: res,
  rejected: [
    'меньше продавать альты на страхе (×0,5/×0,75) и меньше покупать панику (×0,5/×0,75) — минус на старых группах (круг 1)',
    'рыночные сигналы ×0/×0,5 у альтов, не связанных с BTC (corr180 < 0,2–0,4, beta180 < 0,3–0,5) — минус (круг 3)',
    'памп альта в любом рынке (up90 > 200/300/500), продажа после пампа (pump365 > 5/10 и −30/−50% от 90-дн. максимума), просто жадность > 75 — минус или ломает половины (круг 4)',
    'паника рынка ×0/×0,5, пока альт близко к своему 90-дн. максимуму (ddm90 < 20/35/50) — плюс на 100 новых и экзамене, минус на отборе и 50 случайных, худшие половины −30 п.п. (круг 6)',
    'меньше продавать на страхе альт в сильном собственном росте к BTC (rel90 > 50/100/200, rel180 > 100/200) — минус везде (круг 7)',
    'крупнее продавать альт в глубоком падении к BTC (rdd365 > 70/85, rel180 < −50) — плюс, но ломает половину ARIA 2026 на 50 случайных (круг 7)',
    'та же широкая тихая вершина ×k на всех монетах — плюс и остальным (+0,06…+0,14), но на крупных/мемах ломает строгую на 0,1 п.п., а на 100 новых (вся выборка) при ×2 хуже; AS на всех монетах — крупные монеты отбора хуже (5 из 9)'
  ]
};
fs.writeFileSync(__dirname + '/found/seg_alt-best.json', JSON.stringify(best, null, 1));
const m = { strategy: 'found/seg_alt-best.json (АЛЬТ: combo-best + A1 ×1,25 + AS 10% только для альтов)', scheme: 'без изменений: как в found/combo-best-margin.json (R16 + A4 ×1,4 (60 дн) + шорт BTC 20% — лучшая; A4 ×1,3 + шорт 15% — средняя; A4 ×1,25 + шорт 10% — осторожная); новые продажи альтов — группа плеча 4 (продажи гасят долг по монете)',
  model: 'combo_margin.full (agent4d_margin.sim4): 105 стартов 2018–2026, в срок и на день позже, стресс −20/−30% и +20/+30% для шорта; isalt по тикеру', results: MAR };
fs.writeFileSync(__dirname + '/found/seg_alt-best-margin.json', JSON.stringify(m, null, 1));
console.log('сохранено: app/found/seg_alt-best.json, app/found/seg_alt-best-margin.json');
