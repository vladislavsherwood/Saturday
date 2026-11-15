/* tune1 круг 5: сглаживание острого пика волны ликвидаций (oidd30 < −28 → 50%) лесенкой долей вокруг порога —
   «сосед» с меньшей долей (−27/−26 → 20–25%) и более глубокий вынос с большей долей (−30/−32 → 62,5–75%).
   Проверка: строгая вся выборка и сегменты, 100 новых, вперёд по времени (Δ суммы лог-медиан до Y и после Y, Y = 2021…2024).
   Запуск: node app/tune1_r5.js → scratchpad/tune1/r5.json */
const T = require('./tune1_sim.js'); const I = require('./imp8_sim.js'); const { c, S0 } = T; const fs = require('fs');
const OUT = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const G = T.Z.load(); const GS = ['sel', 'ex', 'rnd', 'n100']; const B = T.ev(G, S0, GS);
const R = (t, a) => ({ act: 1 + a / 100, conds: [c('oidd30', '<', t)] });
// после правила #2 (индекс 3 — вставка сразу за волной), до #2 — индекс 2
const V = {
  'после: −27 → 25%': T.insBuy(S0, 3, R(-27, 25)),
  'после: −27 → 20%': T.insBuy(S0, 3, R(-27, 20)),
  'после: −26 → 25%': T.insBuy(S0, 3, R(-26, 25)),
  'после: −26 → 15%': T.insBuy(S0, 3, R(-26, 15)),
  'после: −27 → 30%, −26 → 15%': T.insBuy(T.insBuy(S0, 3, R(-27, 30)), 4, R(-26, 15)),
  'до: −30 → 62,5%': T.insBuy(S0, 2, R(-30, 62.5)),
  'до: −30 → 75%': T.insBuy(S0, 2, R(-30, 75)),
  'до: −32 → 75%': T.insBuy(S0, 2, R(-32, 75)),
  'до: −29 → 40%, волна 50%': T.insBuy(S0, 2, R(-29, 40)),
};
const YS = [2021, 2022, 2023, 2024];
const score = (S, y0, y1) => ['sel', 'ex', 'rnd'].reduce((t, g) => { const v = G[g].map((X) => I.EW(X, S, y0, y1)).filter((x) => x != null); return t + (v.length ? Math.log1p(T.Z.med(v) / 100) : 0); }, 0);
const b = { pre: YS.map((y) => score(S0, null, y)), post: YS.map((y) => score(S0, y, null)) };
const res = {};
for (const [name, S] of Object.entries(V)) {
  const A = T.ev(G, S, GS), o = T.cmp(A, B), n = A.S.n100.all;
  const pre = YS.map((y, k) => +(score(S, null, y) - b.pre[k]).toFixed(3)), post = YS.map((y, k) => +(score(S, y, null) - b.post[k]).toFixed(3));
  res[name] = { inc: o.inc, st: o.st, ok: o.ok, n100: [n.med, n.pos, n.hpos], pre, post, meds: T.meds(A) };
  console.log(name.padEnd(28), T.fmt(o), '| n100', n.med.toFixed(0), n.pos, n.hpos, '| до Y', pre.join(' '), '| после Y', post.join(' '));
}
fs.writeFileSync(OUT + '/r5.json', JSON.stringify(res));
