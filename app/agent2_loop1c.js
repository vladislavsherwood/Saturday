/* Агент 2, круг 1 (окончание): обрыв ниже 19 в основном из-за 2025-07 (BTC у максимума, +18,8% за 30 дней) — «разворот» у вершины
   возвращает весь резерв перед медвежьим рынком. H1e: разворот только из просадки — BTC ниже исторического максимума больше X% (btcath > X);
   H1f: тихая вершина важнее разворота (правило продажи выше разворота). Плато по порогу btcr30 и по X.
   Запуск: node app/agent2_loop1c.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const isRev = (r) => A.has(r, 'btcr30');
function rev(T, X, qtFirst, which = [8, 13]) {
  let S = A.mapRules(A.MAIN, (r) => {
    if (!isRev(r)) return r;
    const k = r.act === 1 ? 7 : A.has(r, 'fund30') ? 8 : 13;
    const conds = r.conds.map((cd) => (cd.ind === 'btcr30' ? c('btcr30', '>', T) : cd));
    return { ...r, conds: X != null && which.includes(k) ? [...conds, c('btcath', '>', X)] : conds };
  });
  if (qtFirst) { const q = S.rules.findIndex((r) => A.has(r, 'qt')), i = S.rules.findIndex((r) => isRev(r) && A.has(r, 'fund30')); const qr = S.rules[q]; const R = S.rules.filter((_, j) => j !== q); R.splice(i, 0, qr); S = { ...S, rules: R }; }
  return S;
}
const rows = [];
console.log(A.HDR); console.log(A.show('основа', base, base));
for (const qtFirst of [false, true]) for (const X of [null, 3, 5, 8, 10, 12, 15, 20, 25]) for (const which of X == null ? [[8, 13]] : [[8, 13], [7, 8, 13]]) {
  const line = [];
  for (const T of [12, 15, 17, 18, 19, 20, 21, 22, 25, 30]) {
    const r = A.ev(G, rev(T, X, qtFirst, which)); r.tag = `${qtFirst ? 'тихая вершина выше разворота, ' : ''}${X == null ? 'без btcath' : `btcath > ${X} в правилах ${which.join('+')}`}, btcr30 > ${T}`; r.dd = A.d(r, base); rows.push(r);
    line.push(`${T}:${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(2)}${A.passes(r, base) ? '✔' : ''}`);
  }
  console.log(`${qtFirst ? 'qt↑ ' : '    '}${(X == null ? '—' : 'btcath>' + X + ' ' + which.join('+')).padEnd(18)} | ${line.join(' ')}`);
}
console.log('\nлучшие 20:');
for (const r of rows.sort((a, b) => b.dd - a.dd).slice(0, 20)) console.log(A.show(r.tag, r, base));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop1c.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
