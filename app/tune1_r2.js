/* tune1 круг 2: «вперёд по времени» для порогов покупок у дна (требование координатора / imp8).
   Для Y = 2021…2024: подбор значения по окну [начало, Y) (сумма лог-медиан отбор+экзамен+50 случ., старт с нуля в окне, ≥ 365 дней),
   проверка на [Y, конец) — выбранное против combo2. Помощник окон — imp8_sim.EW (только чтение).
   Запуск: node app/tune1_r2.js → scratchpad/tune1/r2.json */
const T = require('./tune1_sim.js'); const I = require('./imp8_sim.js'); const { c, S0 } = T; const fs = require('fs');
const OUT = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const G = T.Z.load();
const rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; };
const dlyR = (p, act = 1.5) => { let k; T.prep(G, (X) => { if (X.ind.oidd30) k = T.dly(X, p); }); return { act, conds: [c(k, '>', 0.5)] }; };
const SW = {
  'капитуляция: порог страха': [10, rng(6, 14, 1).map((v) => [v, T.setBuy(S0, 0, { act: 1.25, conds: [c('fng', '<', v)] })])],
  'волна: порог OI': [-28, rng(-33, -23, 0.5).map((v) => [v, T.setBuy(S0, 2, { act: 1.5, conds: [c('oidd30', '<', v)] })])],
  'отложенная: порог выноса': [-28, rng(-33, -23, 0.5).map((v) => [v, T.setBuy(S0, 1, dlyR({ t: v }))])],
  'отложенная: толпа сейчас >': [1, rng(0.9, 1.1, 0.01).map((v) => [v, T.setBuy(S0, 1, dlyR({ x: v }))])],
  'отложенная: дни': ['f', ['f', 'k2', 'k3', 'k5'].map((v) => [v, T.setBuy(S0, 1, dlyR({ m: v }))])],
};
const YS = [2021, 2022, 2023, 2024];
const score = (S, y0, y1) => ['sel', 'ex', 'rnd'].reduce((t, g) => { const v = G[g].map((X) => I.EW(X, S, y0, y1)).filter((x) => x != null); return t + (v.length ? Math.log1p(T.Z.med(v) / 100) : 0); }, 0);
const res = {};
for (const [name, [cur, L]] of Object.entries(SW)) {
  res[name] = {};
  const sc = L.map(([v, S]) => ({ v, S, pre: YS.map((y) => score(S, null, y)), post: YS.map((y) => score(S, y, null)) }));
  const base = sc.find((x) => x.v === cur);
  console.log('\n## ' + name);
  YS.forEach((y, k) => {
    const best = sc.reduce((a, b) => (b.pre[k] > a.pre[k] + 1e-9 ? b : a), base);
    const d = best.post[k] - base.post[k];
    res[name][y] = { pick: best.v, pre_gain: best.pre[k] - base.pre[k], post_gain: d };
    console.log(`  до ${y}: выбрано ${best.v} (в окне ${(best.pre[k] - base.pre[k]).toFixed(3)}) → после ${y}: ${d >= 0 ? '+' : ''}${d.toFixed(3)}`);
  });
  res[name].table = sc.map((x) => ({ v: x.v, pre: x.pre.map((p, k) => +(p - base.pre[k]).toFixed(3)), post: x.post.map((p, k) => +(p - base.post[k]).toFixed(3)) }));
  for (const x of res[name].table) console.log(`   ${String(x.v).padStart(6)} до: ${x.pre.join(' ')} | после: ${x.post.join(' ')}`);
}
fs.writeFileSync(OUT + '/r2.json', JSON.stringify(res));
