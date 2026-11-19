/* wk, круг 1 (продолжение): карта плато «частота × β (уровни от волатильности) × масштаб уровней a × доли m» с устойчивой метрикой
   (средний лог по 81 монете и по 100 новым). Уровни: −ln(1−k) = z·a·(σ/0,05)^β, z — от −25/−40/−60%; доли 10/20/30% × m.
   Запуск: node wk_r1b.js > scratchpad/wk/r1b.log */
const W = require('./wk_lib.js'), { ev, pol, LV0, sd } = W;
const Z0 = LV0.map(([k]) => -Math.log(1 - k));
const VL = (b, a = 1, m = 1) => (X, j) => { const s = sd(X, j), r = b && isFinite(s) ? Math.pow(s / 0.05, b) : 1; return LV0.map(([, f], q) => [1 - Math.exp(-Z0[q] * a * r), f * m]); };
W.head();
const out = [];
for (const e of [3, 2]) for (const b of [0, 0.25, 0.5]) for (const a of [0.8, 0.9, 1, 1.1]) for (const m of [0.75, 1, 1.25]) {
  const o = ev(`e${e} β${b} a${a} m${m}`, pol({ every: e, once: 1, size: 'place', lv: VL(b, a, m) }), { n100: true, w: 24 });
  out.push({ e, b, a, m, all: o.all, ok: o.ok, m81: o.m81, n: o.n, nu: o.nu, nd: o.nd, h1: o.h1, h2: o.h2 });
}
// сводка: для каждой (e, β) — среднее по сетке a×m (плато) и число ✔
for (const e of [3, 2]) for (const b of [0, 0.25, 0.5]) {
  const a = out.filter((x) => x.e === e && x.b === b), mn = (k) => a.reduce((t, x) => t + x[k], 0) / a.length;
  console.log(`сводка e${e} β${b}: ✔ ${a.filter((x) => x.ok).length}/${a.length} | доход ср ${mn('all').toFixed(3)} | 81 ср ${mn('m81').toFixed(3)} | 100н ср ${mn('n').toFixed(3)} | пол ${mn('h1').toFixed(2)}/${mn('h2').toFixed(2)}`);
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/wk/r1b.json', JSON.stringify(out));
