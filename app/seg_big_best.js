/* Круг 10. Итог по крупным: окна истории, доля кэша по фазам, метрики дна/вершин на 9 крупных; сохраняет found/seg_big-best.json.
   Запуск: node app/seg_big_best.js <lab8.log-разбор не нужен> — цифры стенда и маржи читаются из scratchpad/seg_big/{cands8.lab.json, margin9.json} */
const Z = require('./seg_big_sim.js'); const { K } = Z; const fs = require('fs');
const DIR = process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/seg_big';
const G = Z.load(['sel', 'ex', 'rnd', 'n100']); Z.addBig(G); const S = Z.BASE_S;
const V = { 'основа': S, B65: Z.B65(), 'список|B65': Z.LB65() };
const bigX = Z.bigOf(G), out = {};
for (const nm in V) {
  const o = { coins: {}, cash: {}, metricsBig: null };
  for (const X of bigX) { o.coins[X.name] = {}; for (const w of Z.windows(X)) o.coins[X.name][w.k] = +Z.Ew(X, V[nm], w.a, w.b).toFixed(1);
    const { fr } = Z.cashPath(X, V[nm]); let bu = 0, bn = 0, be = 0, bm = 0; for (let i = 0; i < X.n; i++) { if (X.ind.sma200[i] > 1 && X.ind.btcath[i] < 20) { bu += fr[i]; bn++; } else if (X.ind.btcath[i] > 40) { be += fr[i]; bm++; } }
    o.cash[X.name] = { bull: +(100 * bu / bn).toFixed(0), bear: +(100 * be / Math.max(1, bm)).toFixed(0) }; }
  o.metricsBig = K.metrics(bigX, V[nm]);
  out[nm] = o;
  console.log(`\n== ${nm}: ` + K.fmtM(o.metricsBig));
  console.log('монета: вся / h1 / h2 / кэш в бычьей фазе / кэш при BTC > 40% ниже максимума');
  for (const X of bigX) { const q = o.coins[X.name]; console.log(`  ${X.name}: ${q.full} / ${q.h1} / ${q.h2} / ${o.cash[X.name].bull}% / ${o.cash[X.name].bear}%`); }
}
const yrs = (nm) => { let n = 0, neg = 0; for (const X of bigX) for (const k in out[nm].coins[X.name]) if (k[0] === 'y') { n++; if (out[nm].coins[X.name][k] < 0) neg++; } return `${neg}/${n}`; };
console.log('\nкалендарных лет хуже DCA у крупных: ' + Object.keys(V).map((nm) => `${nm} ${yrs(nm)}`).join(', '));
// сохранить итог
const r = {}; for (const nm in V) r[nm] = K.ev(G, V[nm], false);
const pick = (s) => ({ med: +s.med.toFixed(1), pos: s.pos, n: s.n, worst: +s.worst.toFixed(1), hpos: s.hpos, hn: s.hn, hworst: +s.hworst.toFixed(1) });
const lab = fs.existsSync(DIR + '/cands8.lab.json') ? JSON.parse(fs.readFileSync(DIR + '/cands8.lab.json', 'utf8')) : null;
const best = {
  name: 'B65: combo-best + у «крупных по поведению» (corr180 > 0,65 и vol180 < 90) тихие вершины ×1,5 и продажи на страхе ×1,25',
  base: S.base, rules: V.B65.rules,
  rules_human: ['Основа — found/combo-best.json (F + C1.25 + C6) без изменений.',
    'Новое: если корреляция дневных доходностей монеты с BTC за 180 дней > 0,65 и годовая волатильность монеты за 180 дней < 90% («ведёт себя как крупная монета»), то',
    '  — продажи на тихой вершине (узкой qt и широкой BTC < 15% от максимума и доля альтов за 90 дн > +1 п.п.) ×1,5: 40% → 60%, 50% → 75% (у отстающих от BTC 62,5% → 93,75%);',
    '  — продажи на страхе (fng < 52 и доля стейблов < 7,6%) ×1,25: 16% → 20%, при fng < 40 30% → 37,5% (у отстающих ×1,25 ещё раз).',
    'Копии правил с условием признака стоят перед исходными правилами (как правило C). Покупки, возврат, разворот, фандинг, памп — без изменений.'],
  indicators: { corr180: 'корреляция дневных лог-доходностей монеты и BTC за 180 дней (не меньше 144 наблюдений, иначе нет значения — условие не выполнено); у BTC = 1',
    vol180: 'стандартное отклонение дневных лог-доходностей монеты за 180 дней × √365 × 100, %', isbig: 'только для варианта «список|B65»: 1 для BTC, ETH, BNB, XRP, SOL, TRX, ADA, LTC, BCH' },
  variant_list_or_behaviour: { name: 'список|B65: то же правило, если монета в списке крупных ИЛИ ведёт себя как крупная', rules: V['список|B65'].rules },
  big_list: Z.BIG,
  results: { fast: Object.fromEntries(Object.keys(V).map((nm) => [nm, { sel: pick(r[nm].sel), ex: pick(r[nm].ex), rnd: pick(r[nm].rnd), n100: pick(r[nm].n100),
    income_vs_base: +K.d(r[nm], r['основа']).toFixed(3), strict_vs_base: K.passes(r[nm], r['основа']), better_worse_n100: K.bw(r[nm], r['основа'], 'n100') }])),
    lab: lab ? { rows: lab.rows.map((x) => ({ tag: x.tag, sel: pick(x.sel), ex: pick(x.ex), rnd: pick(x.rnd), met: x.met })), n100: lab.n100 } : null,
    big_coins: out },
  note: 'Подробности и все проверки — app/research/seg_big_journal.md; маржа — found/seg_big-best-margin.json.' };
fs.writeFileSync(__dirname + '/found/seg_big-best.json', JSON.stringify(best, null, 1));
console.log('сохранено: app/found/seg_big-best.json');
