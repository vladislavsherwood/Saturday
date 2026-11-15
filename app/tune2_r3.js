/* tune2 круг 3: доли паники при новом множителе сильной паники m = 2 (шаг 0,5 п.п. вокруг текущих); основа сравнения — combo2 и m = 2.
   Вывод — scratchpad/tune2_r3.json */
const T = require('./tune2_sim.js');
const fs = require('fs');
const rng = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(4)); return o; };
const M = +(process.env.M || 2);
const G = T.load(['sel', 'ex', 'rnd']), B = T.ev(G, T.P0), BM = T.ev(G, { m: M });
const OUT = `/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/tune2_r3_m${M}.json`;
const GR = { a1: rng(20, 30, 0.5), a2: rng(45, 55, 0.5), a3: rng(45, 55, 0.5), b1: rng(5, 15, 0.5), b2: rng(5, 15, 0.5), b3: rng(5, 15, 0.5), b: rng(5, 15, 0.5) };
const res = {};
console.log(T.row(`m=${M}`, BM, B));
for (const k in GR) {
  console.log('\n== ' + k + ` (m=${M}; ✔ к combo2 | к m=${M})`); res[k] = [];
  for (const v of GR[k]) {
    const p = k === 'b' ? { m: M, b1: v, b2: v, b3: v } : { m: M, [k]: v };
    const R = T.ev(G, p), q = T.cmp(R, B), q2 = T.cmp(R, BM);
    console.log(T.row(k + '=' + v, R, B) + ' | к m: ' + T.f3(q2.d.all) + (q2.ok ? ' ✔' : ' ·'));
    res[k].push({ v, ok: q.ok, d: q.d, why: q.why, ok2: q2.ok, d2: q2.d });
  }
  fs.writeFileSync(OUT, JSON.stringify(res));
}
