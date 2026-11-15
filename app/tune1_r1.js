/* tune1 круг 1: одномерные развёртки параметров трёх покупок у дна вокруг combo2 (остальное не трогается).
   Запуск: node app/tune1_r1.js → scratchpad/tune1/r1.json + таблица в stdout */
const T = require('./tune1_sim.js'); const { c, S0 } = T; const fs = require('fs');
const OUT = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const G = T.Z.load(); const B = T.ev(G, S0);
const rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; };
const dlyR = (p, act = 1.5) => { let k; T.prep(G, (X) => { if (X.ind.oidd30) k = T.dly(X, p); }); return { act, conds: [c(k, '>', 0.5)] }; };
const oiR = (t, W, act = 1.5) => { let k = 'oidd30'; if (W !== 30) T.prep(G, (X) => { if (X.ind.oidd30) { T.oidd(X, W); k = 'oiddW' + W; } }); return { act, conds: [c(k, '<', t)] }; };
const SW = {
  'капитуляция: порог страха': rng(6, 14, 1).map((v) => [v, T.setBuy(S0, 0, { act: 1.25, conds: [c('fng', '<', v)] })]),
  'капитуляция: доля %': rng(15, 35, 1).map((v) => [v, T.setBuy(S0, 0, { act: 1 + v / 100, conds: [c('fng', '<', 10)] })]),
  'волна: порог OI': rng(-33, -23, 0.5).map((v) => [v, T.setBuy(S0, 2, oiR(v, 30))]),
  'волна: окно максимума': rng(20, 40, 1).map((v) => [v, T.setBuy(S0, 2, oiR(-28, v))]),
  'волна: доля %': rng(40, 60, 1).map((v) => [v, T.setBuy(S0, 2, oiR(-28, 30, 1 + v / 100))]),
  'отложенная: окно дней': rng(12, 30, 1).map((v) => [v, T.setBuy(S0, 1, dlyR({ w: v }))]),
  'отложенная: порог выноса': rng(-33, -23, 0.5).map((v) => [v, T.setBuy(S0, 1, dlyR({ t: v }))]),
  'отложенная: толпа сейчас >': rng(0.9, 1.1, 0.01).map((v) => [v, T.setBuy(S0, 1, dlyR({ x: v }))]),
  'отложенная: мин. толпы <': rng(0.8, 1.0, 0.01).map((v) => [v, T.setBuy(S0, 1, dlyR({ y: v }))]),
  'отложенная: окно макс. OI': rng(20, 40, 1).map((v) => [v, T.setBuy(S0, 1, dlyR({ W: v }))]),
  'отложенная: доля %': rng(40, 70, 1).map((v) => [v, T.setBuy(S0, 1, dlyR({}, 1 + v / 100))]),
  'отложенная: дни': ['f', 'k2', 'k3', 'k5', 'k10', 'a'].map((v) => [v, T.setBuy(S0, 1, dlyR({ m: v }))]),
};
const res = {};
for (const [name, L] of Object.entries(SW)) {
  console.log('\n## ' + name); res[name] = [];
  for (const [v, S] of L) { const A = T.ev(G, S), o = T.cmp(A, B); res[name].push({ v, inc: o.inc, st: o.st, ok: o.ok, meds: T.meds(A) }); console.log(String(v).padStart(6), T.fmt(o), '|', T.meds(A)); }
}
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + '/r1.json', JSON.stringify(res));
