/* r4, круг 7: устойчивость к задержке исполнения и walk-forward по эпохам для combo4 и кандидата «эйфория мемов 10%» (M10).
   Гипотеза: перевес combo4 и добавки M10 не держится на точном дне исполнения: при задержке 2–5 дней доход падает плавно (не больше ~10% лог-перевеса на день),
   а M10 остаётся в плюсе при любой задержке и в каждой эпохе, где срабатывает. Критерий (заранее): M10 ≥ 0 к combo4 при задержках 2, 3, 5, 7 и в каждой эпохе
   («правило разрешено только до D» / «только с D», D = 2023-01-01 и 2025-01-01). Запуск: node r4_r7.js */
const L = require('./r4_lib.js'), { S0, c, Z, P, G } = L;
const M = (s = 0.1, extra = []) => { const S = L.clone(); S.rules.push({ act: -s, conds: [c('usdt', '<', 0.9), c('age', '>', 540), c('meme', '>', 0.5), c('beta180', '>', 0.9), ...extra] }); return S; };
const noE = () => { const S = L.clone(); S.rules.pop(); return S; };
const inc = (R, s = 'all') => Z.inc(Z.sum(R), s);
const dcaInc = 0; // доход считается к DCA: Σ ln(1 + медиана)
console.log('задержка | combo4: Σ лог-медиан (отбор/экзамен/50 сл. медианы) | M10 к combo4 (всё / мемы) | эйфория к «без эйфории» | отложенная к «без отложенной»');
for (const lags of [[0, 1], [0], [1], [2], [3], [5], [7], [10]]) {
  const b = L.evLag(S0, L.pol0, lags), m = L.evLag(M(), L.pol0, lags), e = L.evLag(noE(), L.pol0, lags), d = L.evLag(S0, null, lags), s = Z.sum(b);
  console.log(`${('[' + lags.join(',') + ']').padEnd(7)} ${inc(b).toFixed(3)} (${['sel', 'ex', 'rnd'].map((g) => Math.round(s[g].all.med)).join(' / ')}) | M10 ${L.sg(inc(m) - inc(b))} / ${L.sg(inc(m, 'meme') - inc(b, 'meme'))} | эйфория ${L.sg(inc(b) - inc(e))} | отложенная ${L.sg(inc(b) - inc(d))}`);
}
console.log('— эпохи: M10 разрешено только до D / только с D (доход мемов к combo4, строгая) —');
for (const D of ['2023-01-01', '2024-07-01', '2025-01-01']) { const t = L.T(D); L.run(`M10 только до ${D}`, M(0.1, [c('t', '<', t)])); L.run(`M10 только с ${D}`, M(0.1, [c('t', '>', t - 1)])); }
console.log('— эпохи: эйфория combo4 (не мемы) только до D / только с D, к combo4 без эйфории —');
P.setBaseline(noE(), L.pol0);
for (const D of ['2019-01-01', '2022-01-01', '2024-07-01']) { const t = L.T(D); const f = (op) => { const S = noE(); const e = L.EUPH(); e.conds.push(c('t', op, op === '<' ? t : t - 1)); S.rules.push(e); return S; }; L.run(`эйфория только до ${D}`, f('<')); L.run(`эйфория только с ${D}`, f('>')); }
P.setBaseline(S0, L.pol0);
module.exports = { M };
