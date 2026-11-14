/* Агент 2, круг 1 (продолжение): обрыв ниже порога 19 у разворота — это 4 события с ростом BTC за 30 дней 17,5–20%
   (2016-03, 2019-01, 2025-07, 2026-04), три из них — ложные развороты. H1d: фильтр «медвежьего ралли» — возвращать весь резерв,
   только если BTC за 90 дней не в минусе (btcr90) или выше средней 200 (btc200); иначе — часть резерва или ничего.
   Ищем плато по порогу btcr30. Запуск: node app/agent2_loop1b.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const isRev = (r) => A.has(r, 'btcr30');
// T — порог btcr30 во всех трёх правилах; flt — фильтр к правилам 8 и 13 (полный возврат); fb — действие, если фильтр не прошёл (null — ничего)
function rev(T, flt, fb, only13 = false) {
  return A.mapRules(A.MAIN, (r) => {
    if (!isRev(r)) return r;
    const conds = r.conds.map((cd) => (cd.ind === 'btcr30' ? c('btcr30', '>', T) : cd)), R = { ...r, conds };
    if (r.act === 1 || !flt || (only13 && A.has(r, 'fund30'))) return R;
    const out = [{ ...R, conds: [...conds, flt] }];
    if (fb && !A.has(r, 'fund30')) out.push({ ...R, act: fb });
    return out;
  });
}
const rows = [];
console.log(A.HDR); console.log(A.show('основа', base, base));
const FL = [[null, 'без фильтра'], [c('btcr90', '>', -10), 'btcr90 > −10'], [c('btcr90', '>', 0), 'btcr90 > 0'], [c('btcr90', '>', 10), 'btcr90 > 10'],
  [c('btc200', '>', 0.9), 'btc200 > 0,9'], [c('btc200', '>', 1), 'btc200 > 1'], [c('btc200', '>', 1.1), 'btc200 > 1,1'], [c('btcath', '<', 30), 'btcath < 30']];
for (const [flt, ft] of FL) for (const fb of flt ? [null, 1.25, 1.5] : [null]) {
  const line = [];
  for (const T of [15, 17, 18, 19, 20, 21, 22, 25, 30]) {
    const r = A.ev(G, rev(T, flt, fb)); r.tag = `${ft}, иначе ${fb ? (fb - 1) * 100 + '%' : 'ничего'}, btcr30 > ${T}`; r.dd = A.d(r, base); rows.push(r);
    line.push(`${T}:${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(2)}${A.passes(r, base) ? '✔' : ''}`);
  }
  console.log(`${ft.padEnd(14)} иначе ${(fb ? (fb - 1) * 100 + '%' : 'ничего').padEnd(7)} | ${line.join(' ')}`);
}
console.log('\nлучшие 15:');
for (const r of rows.sort((a, b) => b.dd - a.dd).slice(0, 15)) console.log(A.show(r.tag, r, base));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop1b.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
