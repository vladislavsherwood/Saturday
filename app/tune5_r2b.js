/* tune5, круг 2б: проверка порога разворота по просьбе imp1 — «исключить эпизод». Два ложных разворота 2025-07 (+18,8%) и 2026-04 (+18,6%)
   убираются из индикатора (btcr30 → 0 на 40 дней от первого дня > 17 в эпизоде) — новый индикатор btcr30x у всех монет; кривая порога 18…21.
   Если обрыв ниже 19 — это только эти два эпизода, без них кривая должна быть ровной. Запуск: node app/tune5_r2b.js */
const T = require('./tune5_sim.js'); const { G } = T.init();
const day = (s) => Math.round(Date.parse(s) / 864e5);
const BTC = G.sel.concat(G.ex, G.rnd).find((x) => x.name === 'BTC');
const fmtd = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
// эпизоды: первый день btcr30 > 17 после ≥ 30 дней без; максимум за 30 дней
const eps = []; let last = -99;
for (let i = 0; i < BTC.n; i++) if (BTC.ind.btcr30[i] > 17) { if (i - last > 30) { let m = 0; for (let j = i; j < Math.min(BTC.n, i + 30); j++) m = Math.max(m, BTC.ind.btcr30[j]); eps.push({ t: BTC.t[i], m }); } last = i; }
console.log('эпизоды с максимумом 17–21%:', eps.filter((e) => e.m < 21).map((e) => `${fmtd(e.t)} (${e.m.toFixed(1)})`).join(', '));
const EX = eps.filter((e) => ['2025-07', '2026-04'].includes(fmtd(e.t).slice(0, 7)));
console.log('исключаю:', EX.map((e) => fmtd(e.t)).join(', '));
for (const g in G) for (const X of G[g]) { const a = Float64Array.from(X.ind.btcr30); for (let i = 0; i < X.n; i++) if (EX.some((e) => X.t[i] >= e.t - 5 && X.t[i] < e.t + 40)) a[i] = 0; X.ind.btcr30x = a; }
const sw = (S) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((x) => (x.ind === 'btcr30' ? { ...x, ind: 'btcr30x' } : x)) })) });
for (const v of [18, 18.5, 18.75, 19, 19.25, 19.5, 20, 20.5, 20.75, 21]) {
  const a = T.evalS(T.rev({ T: v })), b = T.evalS(sw(T.rev({ T: v })));
  console.log(T.fmt('T=' + v, a)); console.log(T.fmt('  без 2 эпизодов', b));
}
