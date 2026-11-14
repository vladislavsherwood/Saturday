/* Агент «АЛЬТЫ», круг 6: «резерв ушёл в падение до настоящего дна» — паника рынка, когда сам альт ещё не упал.
   Гипотеза (заранее): у альта покупка резерва на панике рынка преждевременна, пока монета близко к своему 90-дн. максимуму (ddm90 < X):
   настоящее дно альта ещё впереди (ARIA, HYPE, KAS, TON в октябре 2025). В такие дни покупки паники (#3–8, #11–13) ×0 или ×0,5;
   X = 20/35/50%. Отличие от агента 4A (круг 1: «только на новых минимумах монеты», отвергнуто) — мягкий порог по глубине самой монеты
   и только альты. Проверяю и вариант для всех монет. Сверху основы и сверху A1 + AS.
   Запуск: node app/seg_alt_loop6.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const ALT = c('isalt', '>', 0.5);
const up = (S, qs, k, extra) => ({ ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...extra] }, r] : [r])) });
const A1 = up(B, [23, 24], 1.5, [ALT]);
const AS = (S, f = 65, o = 1, s = 0.05) => ({ ...S, rules: [...S.rules, { act: -s, conds: [ALT, c('fng', '>', f), c('oth90', '>', o)] }] });
const PANIC = (r) => r.act > 1 && r.conds.some((x) => x.ind === 'usdt');
const BOTTOM = (r) => r.act > 1 && r.conds.some((x) => ['fng', 'dly20_100f', 'oidd30'].includes(x.ind)) && r.conds.length === 1;
const guard = (S, which, k, extra) => ({ ...S, rules: S.rules.flatMap((r) => (which(r) ? [{ act: +(1 + (r.act - 1) * k).toFixed(6), conds: [...r.conds, ...extra] }, r] : [r])) });
const L = [];
const base2 = AS(A1);
for (const [bn, S0] of [['основа', B], ['A1+AS', base2]]) for (const X of [20, 35, 50]) for (const k of [0, 0.5]) {
  L.push([`${bn}: альты, паника ×${k} при ddm90<${X}`, guard(S0, PANIC, k, [ALT, c('ddm90', '<', X)])]);
  if (bn === 'основа' && k === 0) { L.push([`${bn}: ВСЕ, паника ×0 при ddm90<${X}`, guard(S0, PANIC, 0, [c('ddm90', '<', X)])]); L.push([`${bn}: альты, паника и дно ×0 при ddm90<${X}`, guard(S0, (r) => PANIC(r) || BOTTOM(r), 0, [ALT, c('ddm90', '<', X)])]); }
}
const out = [];
console.log(Q.row('A1+AS', Q.evs(G, base2), rb));
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
