/* imp7, круг 5: финальная проверка кандидата «в медвежьем режиме BTC (rb200 < 1, наклон средней 200 < 0) разворот возвращает долю ×0,5» (и ×0 для сравнения)
   поверх combo-best и поверх combo2-best (появился по ходу работы): все группы быстрым оценщиком (отбор, экзамен, 50 случайных, 100 новых), половины,
   лучше/хуже, метрики дна/вершин, циклы. Цифры стенда — из <lab.json> (imp7_lab.js). Сохраняет found/imp7-best.json.
   Запуск: node app/imp7_final.js [<cands5.lab.json>] */
const M = require('./imp7_sim.js');           // регистрирует rb200, rsl (полная история BTC)
const Z = require('./combo2_sim.js');
const fs = require('fs');
const G = Z.load(['sel', 'ex', 'rnd', 'n100']);
const C2 = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const B2 = { base: C2.base, rules: C2.rules };
const LAB = process.argv[2] && fs.existsSync(process.argv[2]) ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
const CS = M.cycSlices(G);
const pick = (s) => ({ med: +s.med.toFixed(1), pos: s.pos, n: s.n, worst: +s.worst.toFixed(2), hpos: s.hpos, hn: s.hn, hworst: +s.hworst.toFixed(2) });
const OUT = {};
for (const [bn, B] of [['combo-best', M.B0], ['combo2-best', B2]]) {
  const rb = M.ev(G, B, true), cb = M.cycEv(CS, B);
  for (const [vn, S] of [[bn, B], [bn + ' + медведь-разворот ×0,5', M.bearRev(B, 0.5)], [bn + ' + медведь-разворот ×0', M.bearRev(B, 0)]]) {
    const r = vn === bn ? rb : M.ev(G, S, true), cc = M.cycCmp(M.cycEv(CS, S), cb);
    const o = { income: +M.d(r, rb).toFixed(4), strict: M.passes(r, rb), why: M.why(r, rb), cycles: cc.map((x, k) => ({ cycle: M.CYC[k][0], sumlog: +x.s.toFixed(3), better: x.bt, worse: x.wr, n: x.n })), groups: {}, metrics: r.m };
    for (const g of ['sel', 'ex', 'rnd', 'n100']) o.groups[g] = { ...pick(r[g]), betterWorse: M.bw(r, rb, g), h1med: +M.hmed(G, g, S, 'h1').toFixed(1), h2med: +M.hmed(G, g, S, 'h2').toFixed(1) };
    OUT[vn] = o;
    console.log(`\n== ${vn} | к ${bn}: доход ${o.income >= 0 ? '+' : ''}${o.income.toFixed(3)} ${o.strict ? '✔' : '· ' + o.why} | ${M.cycStr(cc)}`);
    for (const [g, t] of [['sel', 'отбор'], ['ex', 'экзамен'], ['rnd', '50 случ.'], ['n100', '100 новых']]) { const q = o.groups[g]; console.log(`  ${t}: ${M.sh(r[g])} | 1-я/2-я пол. ${q.h1med.toFixed(0)}/${q.h2med.toFixed(0)} | лучше/хуже ${q.betterWorse.join('/')}`); }
    console.log('  ' + M.fmtM(r.m));
  }
}
const best = {
  name: 'imp7: combo-best + «в медвежьем режиме BTC разворот возвращает половину обычной доли»',
  base: M.B0.base, rules: M.bearRev(M.B0, 0.5).rules,
  rule_human: 'Если BTC ниже своей 200-дневной средней И сама средняя за 30 дней снизилась (медвежий режим), правила разворота BTC (+20% за 30 дней → весь резерв; ' +
    'при перегретом фандинге → весь резерв) возвращают в рынок только 50% резерва; остальное ждёт следующего сигнала покупки. Вне режима — как в основе.',
  indicators: { rb200: 'BTC / средняя 200 дней по полной истории BTC (не по дням страницы монеты: у стенда btc200 у молодых монет считается по истории страницы)',
    rsl: 'наклон средней 200 BTC за 30 дней, %: (средняя сегодня / средняя 30 дней назад − 1) × 100' },
  on_combo2: { rules: M.bearRev(B2, 0.5).rules, note: 'та же правка поверх combo2-best.json (правила разворота там те же)' },
  results_fast: OUT, lab: LAB,
  events: 'развороты внутри режима: 2018-07-22, 2020-01-14, 2020-04-11 (лучшая покупка — правка её уменьшает), 2022-03-28, 2022-07-31; в 2023–26 событий нет',
  margin: 'см. found/imp7-best-margin.json',
};
fs.writeFileSync(__dirname + '/found/imp7-best.json', JSON.stringify(best, null, 1));
