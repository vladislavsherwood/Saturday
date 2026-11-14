/* Объединение, итог по монетам: W25, F, F + C6 (осторожный, строгая ✔ к F), F + C1.25 + C6 (выбор) — все группы быстрым оценщиком, половины
   истории, лучше/хуже по монетам, метрики дна/вершин; цифры браузерного стенда (combo_lab.js) из <lab.json>. Сохраняет found/combo-best.json.
   Запуск: node app/combo_best.js <cands.lab.json> */
const K = require('./combo_sim.js');
const fs = require('fs');
const G = K.groups(['sel', 'ex', 'rnd', 'n100', 'met']); K.prep(G);
const LAB = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const V = { W25: K.W25, F: K.F, 'F + C6': K.withC6(K.F), 'F + C1.25': K.withC(K.F, 1.25), 'F + C1.25 + C6': K.withC(K.withC6(K.F), 1.25), 'F + C1.5 + C6': K.withC(K.withC6(K.F), 1.5) };
const R = {}, base = K.ev(G, K.W25), fb = K.ev(G, K.F);
const pick = (s) => ({ med: s.med, pos: s.pos, n: s.n, worst: s.worst, hpos: s.hpos, hn: s.hn, hworst: s.hworst });
for (const nm in V) {
  const r = nm === 'W25' ? base : nm === 'F' ? fb : K.ev(G, V[nm]);
  const o = { groups: {}, metrics: r.m, vsW25: { income: K.d(r, base), strict: K.passes(r, base), why: K.why(r, base) }, vsF: { income: K.d(r, fb), strict: K.passes(r, fb), why: K.why(r, fb) } };
  for (const g of ['sel', 'ex', 'rnd', 'n100', 'met']) {
    o.groups[g] = { ...pick(r[g]), h1med: K.hmed(G, g, V[nm], 'h1'), h2med: K.hmed(G, g, V[nm], 'h2'), betterWorseW25: K.bw(r, base, g), betterWorseF: K.bw(r, fb, g) };
    if (g === 'met') o.groups[g].each = r.met.e;
  }
  const lb = LAB.rows.find((x) => x.tag === nm);
  if (lb) o.lab = { sel: pick(lb.sel), ex: pick(lb.ex), rnd: pick(lb.rnd), n100: LAB.n100[nm] };
  R[nm] = o;
  console.log(`\n== ${nm} | к W25 ${o.vsW25.income.toFixed(3)} ${o.vsW25.strict ? '✔' : '· ' + o.vsW25.why} | к F ${o.vsF.income.toFixed(3)} ${o.vsF.strict ? '✔' : '· ' + o.vsF.why}`);
  for (const [g, t] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых'], ['met', 'металлы']]) {
    const q = o.groups[g];
    console.log(`  ${t}: ${K.sh(r[g])} | 1-я/2-я пол. ${q.h1med.toFixed(0)}/${q.h2med.toFixed(0)}% | лучше/хуже W25 ${q.betterWorseW25.join('/')}, F ${q.betterWorseF.join('/')}${g === 'met' ? ' | ' + r.met.e.map((x) => x.toFixed(0)).join('/') : ''}`);
  }
  console.log('  ' + K.fmtM(r.m));
  if (lb) console.log(`  стенд: отбор ${lb.sel.med.toFixed(0)}, экзамен ${lb.ex.med.toFixed(0)}, 50 случ. ${lb.rnd.med.toFixed(0)}, 100 новых ${LAB.n100[nm].med.toFixed(0)} (${LAB.n100[nm].pos}/100, половин ${LAB.n100[nm].hpos}/200, лучше/хуже W25 ${LAB.n100[nm].better}/${LAB.n100[nm].worse})`);
}
const best = {
  name: 'F + C1.25 + C6 (объединение агентов 4A–4E поверх W25)',
  base: V['F + C1.25 + C6'].base, rules: V['F + C1.25 + C6'].rules,
  note: 'W25 (found/agent2-best.json = «K3 + отложенная» + вторая ступень тихой вершины) + F агента 4B (широкая тихая вершина 50% вместо 25%, возврат 10% резерва ' +
    'при новом 90-дн. максимуме монеты ≤ 45 дней после тихой вершины при жадности > 52, продажа 10% пампа альта > +300% от 90-дн. минимума при BTC > 20% ниже максимума) + ' +
    'C агента 4C (все продажи ×1,25, если монета за 180 дней отстала от BTC больше чем на 15%; копия каждого правила продажи с условием rel180 < −15 стоит перед исходным, ' +
    'в том числе для продаж F) + C6 агента 4A (сильная паника usdt > 1,2 → доли покупки правил #3, #5, #9 ×1,5; копия перед исходным). Порядок сборки: C6 по индексам W25, затем C.',
  rules_human: [
    'Всё из W25 («K3 + отложенная» + вторая ступень тихой вершины), без изменения покупок и продаж, кроме перечисленного ниже.',
    'Широкая тихая вершина (BTC < 15% от максимума и доля альтов за 90 дн > +1 п.п.) продаёт 50% вместо 25% (агент 4B).',
    'Возврат: ≤ 45 дней после тихой вершины (узкой или широкой), жадность > 52 и монета на новом 90-дн. максимуме → купить на 10% резерва (агент 4B).',
    'Памп альта в медвежьем рынке: BTC ниже максимума > 20% и монета выше своего 90-дн. минимума > 300% → продать 10% (агент 4B).',
    'Слабая монета: если монета за 180 дней отстала от BTC больше чем на 15% (rel180 < −15), каждая продажа ×1,25 (страх 16→20%, сильный страх 30→37,5%, фандинг 5→6,25%, тихая вершина 40→50%, широкая 50→62,5%, памп 10→12,5%) (агент 4C).',
    'Сильная паника: usdt > 1,2 → доли покупки трёх подтверждённых панических правил ×1,5 (25→37,5%, 50→75%, 50→75% резерва) (агент 4A, C6).'],
  indicators: {
    rel180: '(close / close 180 дней назад) / (BTC / BTC 180 дней назад) − 1, в процентах; для BTC — 0; меньше 180 дней истории монеты — условие не выполнено (правило C «разрешено» только с 181-го дня монеты)',
    ago_qt: 'дней с последнего дня тихой вершины (узкой qt > 0,5 или широкой: btcath < 15 и oth90 > 1); до первой — нет значения (условие не выполнено)',
    up90: 'рост монеты от минимума закрытий за последние 90 дней (включая сегодня), %',
    hi90: 'монета обновила 90-дн. максимум закрытия (уже есть в стенде; в python — за последние 7 дней был день с закрытием ≥ максимума предыдущих 89 дней)'
  },
  cautious: { name: 'F + C6 (строгая ✔ к F)', rules: V['F + C6'].rules },
  results: R,
  rejected: ['фильтр возраста монеты для C (365/450/540/730 дн): ARIA не спасает до 450 дн, а с 450 дн ломает TON (худшая половина отбора)',
    'C на окне 90 дней (rel90 < −10…−25%): хуже худшая половина экзамена (XMR) или 50 случайных',
    'C ×1,5 поверх F: доход выше (+0,21 к F), но теряет половину на 50 случайных и 2 половины на 100 новых']
};
fs.writeFileSync(__dirname + '/found/combo-best.json', JSON.stringify(best, null, 1));
console.log('\nсохранено: app/found/combo-best.json');
