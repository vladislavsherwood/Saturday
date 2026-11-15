/* tune2 круг 2: множитель сильной паники (usdt > 1,2). m 1,5…3,0; по уровням m1/m2/m3 (сильный страх / страх / без страха);
   потолок сильной доли cap; us при новом m (остался ли пиком). Вывод — scratchpad/tune2_r2.json */
const T = require('./tune2_sim.js');
const fs = require('fs');
const rng = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(4)); return o; };
const G = T.load(['sel', 'ex', 'rnd']), B = T.ev(G, T.P0);
const OUT = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/tune2_r2.json';
const res = {};
const run = (name, list) => { console.log('\n== ' + name); res[name] = []; for (const [v, p] of list) { const R = T.ev(G, p), q = T.cmp(R, B); console.log(T.row(name + '=' + v, R, B)); res[name].push({ v, p, ok: q.ok, d: q.d, why: q.why, med: [R.sel.all.med, R.ex.all.med, R.rnd.all.med] }); } fs.writeFileSync(OUT, JSON.stringify(res)); };
run('m', rng(1.5, 3.0, 0.1).map((v) => [v, { m: v }]));
for (const k of ['m1', 'm2', 'm3']) run(k, rng(1.0, 3.0, 0.1).map((v) => [v, { [k]: v }]));
run('cap(m=3)', [50, 60, 70, 75, 80, 90, 100, 120, 150].map((v) => [v, { m: 3, cap: v }]));
run('us(m=2)', rng(1.15, 1.25, 0.01).map((v) => [v, { m: 2, us: v }]));
