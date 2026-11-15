/* tune2 круг 1: перебор по одному параметру мелким шагом при остальных как в combo2 (отбор, экзамен, 50 случайных).
   Запуск: node app/tune2_r1.js [список параметров через запятую] > вывод; JSON — scratchpad/tune2_r1.json */
const T = require('./tune2_sim.js');
const fs = require('fs');
const rng = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(4)); return o; };
const GRID = {
  u: rng(1.0, 1.14, 0.005), w: rng(150, 250, 5), o: rng(22, 28, 0.5), fs: rng(34, 46, 1), fw: rng(46, 58, 1), ud: rng(7.0, 8.2, 0.1),
  oi: rng(4, 12, 0.5), us: rng(1.10, 1.30, 0.01), m: rng(1.0, 2.0, 0.05),
  a1: rng(15, 35, 0.5), a2: rng(35, 65, 0.5), a3: rng(35, 65, 0.5), b1: rng(0, 20, 0.5), b2: rng(0, 20, 0.5), b3: rng(0, 20, 0.5), b: rng(0, 20, 0.5),
};
const keys = process.argv[2] ? process.argv[2].split(',') : Object.keys(GRID);
const G = T.load(['sel', 'ex', 'rnd']), B = T.ev(G, T.P0);
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/tune2_r1.json';
const res = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
for (const k of keys) {
  console.log(`\n== ${k} (сейчас ${k === 'b' ? 10 : T.P0[k]})`);
  res[k] = [];
  for (const v of GRID[k]) {
    const p = k === 'b' ? { b1: v, b2: v, b3: v } : { [k]: v };
    const R = T.ev(G, p), q = T.cmp(R, B);
    console.log(T.row(k + '=' + v, R, B));
    res[k].push({ v, ok: q.ok, d: q.d, why: q.why, med: [R.sel.all.med, R.ex.all.med, R.rnd.all.med] });
  }
  fs.writeFileSync(OUT, JSON.stringify(res));
}
