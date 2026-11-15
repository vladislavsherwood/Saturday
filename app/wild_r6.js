/* Круг 6. «Толпа клонов»: монета делится на K равных подсчетов (взнос / K каждому), каждый торгует копией combo4 со сдвинутыми порогами.
   Клон: у каждого индикатора свой случайный множитель порога (1 + δ·z), z ~ U[−1, 1] (одинаков для всех правил клона); флаги (порог 0,5) не трогаю.
   Отложенная паника клона — те же t/rv, сдвинутые на δ/4 (это отношения около 1). Итог монеты = сумма итогов подсчетов; DCA — та же.
   inc0 — оригинал входит в толпу как один из клонов. Запуск: node wild_r6.js > scratchpad/wild/r6.log */
const W = require('./wild_sim.js');
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const FLAGS = new Set(['isbig', 'meme', 'isalt', 'qt', 'hi90', 'dly20_100f']);
function clone(seed, d) {
  const r = rng(seed), f = {}, S = W.clone(W.BASE);
  for (const R of S.rules) for (const c of R.conds) { if (FLAGS.has(c.ind)) continue; if (!(c.ind in f)) f[c.ind] = 1 + d * (2 * r() - 1); c.v = +(c.ind === 'usdt' ? 1 + (c.v - 1) * f[c.ind] : c.v * f[c.ind]).toFixed(6); } // usdt — отношение к средней: сдвигаю избыток v − 1
  const t = Math.min(0.995, 0.98 * (1 + (d / 4) * (2 * r() - 1))), rv = Math.min(t - 0.005, 0.965 * (1 + (d / 4) * (2 * r() - 1)));
  return [S, W.H2.Boost(2, { k: 0, t, rv }), null];
}
function crowd(K, d, seed, inc0 = true) { const e = []; if (inc0) e.push([W.BASE, W.POL, null]); for (let k = e.length; k < K; k++) e.push(clone(seed * 1000 + k, d)); return e; }
const arg = process.argv[2] || 'grid';
W.report('combo4');
if (arg === 'grid') {
for (const d of [0.03, 0.06, 0.1]) for (const seed of [1, 2]) W.report(`толпа K8 δ${d} seed${seed}`, null, null, null, { ens: crowd(8, d, seed) });
W.report('толпа K8 δ0.06 без оригинала', null, null, null, { ens: crowd(8, 0.06, 3, false) });
// одиночные клоны (для сравнения: средний клон против толпы)
for (let k = 1; k <= 4; k++) { const [S, pol] = clone(2000 + k, 0.06); W.report(`клон δ0.06 #${k}`, S, pol); }
}
if (arg === 'one') { // чувствительность: сдвиг одного индикатора на ±δ во всех правилах
  const inds = [...new Set(W.BASE.rules.flatMap((r) => r.conds.map((c) => c.ind)))].filter((k) => !FLAGS.has(k));
  for (const k of inds) for (const z of [-1, 1]) { const S = W.clone(W.BASE); for (const R of S.rules) for (const c of R.conds) if (c.ind === k) c.v = +(k === 'usdt' ? 1 + (c.v - 1) * (1 + 0.05 * z) : c.v * (1 + 0.05 * z)).toFixed(6); W.report(`${k} ${z > 0 ? '+' : '−'}5%`, S); }
}
console.log(W.summary());
