/* imp1, круг 4. Гипотеза (заранее): обрыв порога «BTC +20% за 30 дней» (ниже 19 резко хуже) делают ложные развороты 2025-07 (у максимума,
   bdays ≈ 0) и 2026-04 (медвежье ралли, ~190 дней после максимума октября 2025). Если в «молодом медвежьем рынке» (D1 < bdays < D2) разворот
   покупает только часть резерва (круг 1: +0,04…+0,06 к combo2 при пороге 20), то 2026-04 и другие медвежьи ралли станут дешевле, и кривая
   дохода по порогу T = 15…25 станет пологой: при T = 17–19 потеря против T = 20 меньше вдвое, чем у основы. Критерий: (1) при T = 20 доход ≥ основы
   и строгая ✔ или провал на сотых; (2) мин. дохода по T = 17…22 выше, чем у основы, на ≥ 0,2. Запуск: node app/imp1_loop4.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']); K.prep1(G);
const base = K.ev(G, K.S0, false);
const c = K.c;
const thr = (S, T) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((x) => (x.ind === 'btcr30' ? { ...x, v: T } : x)) })) });
const win = (D1, D2, a) => K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, c('bdays', '>', D1), c('bdays', '<', D2)] }, r]);
const TS = [15, 17, 18, 19, 20, 21, 22, 25];
const V = [['основа', K.S0]];
for (const [D1, D2] of [[120, 365], [120, 450], [90, 365], [120, 300]]) for (const a of [1, 1.25, 1.5]) V.push([`${D1}…${D2} ${a === 1 ? 'взнос' : a === 1.25 ? '25%' : '50%'}`, win(D1, D2, a)]);
console.log('вариант \\ порог T: ' + TS.join(' / ') + ' | мин(17…22) | строгая при 20');
for (const [t, S] of V) {
  const ds = TS.map((T) => { const r = K.ev(G, thr(S, T), false); return [K.d(r, base), r]; });
  const r20 = ds[TS.indexOf(20)][1];
  const mn = Math.min(...ds.filter((_, i) => TS[i] >= 17 && TS[i] <= 22).map((x) => x[0]));
  console.log(`${t.padEnd(16)} ${ds.map((x) => (x[0] >= 0 ? '+' : '') + x[0].toFixed(3)).join(' / ')} | ${mn.toFixed(3)} | ${K.passes(r20, base) ? '✔' : '✘ ' + K.why(r20, base)}`);
}
