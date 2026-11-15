/* tune1 круг 3: доли трёх покупок вместе (сетка 2,5 п.п.: капитуляция 20–30%, отложенная 45–60%, волна 42,5–57,5%),
   затем мелкий шаг 0,5 п.п. вокруг лучших прошедших строгую. Запуск: node app/tune1_r3.js → scratchpad/tune1/r3.json */
const T = require('./tune1_sim.js'); const { S0 } = T; const fs = require('fs');
const OUT = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const G = T.Z.load(); const B = T.ev(G, S0);
const rng = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(4)); return o; };
const mk = (a, d, w) => ({ ...S0, rules: S0.rules.map((r, i) => (i === 0 ? { ...r, act: 1 + a / 100 } : i === 1 ? { ...r, act: 1 + d / 100 } : i === 2 ? { ...r, act: 1 + w / 100 } : r)) });
const run = (a, d, w) => { const A = T.ev(G, mk(a, d, w)), o = T.cmp(A, B); return { a, d, w, inc: o.inc, ok: o.ok, nst: Object.values(o.st).reduce((t, v) => t + v.length, 0), st: o.st, meds: T.meds(A) }; };
const res = { grid: [], fine: [] };
for (const a of rng(20, 30, 2.5)) for (const d of rng(45, 60, 2.5)) for (const w of rng(42.5, 57.5, 2.5)) res.grid.push(run(a, d, w));
const top = res.grid.filter((x) => x.ok && x.inc.all > 0).sort((x, y) => y.inc.all - x.inc.all);
console.log('прошли строгую с доходом > 0:', top.length); for (const x of top.slice(0, 15)) console.log(x.a, x.d, x.w, x.inc.all.toFixed(4), x.meds);
const near = res.grid.filter((x) => x.nst <= 1).sort((x, y) => y.inc.all - x.inc.all).slice(0, 15);
console.log('с ≤1 нарушением:'); for (const x of near) console.log(x.a, x.d, x.w, x.inc.all.toFixed(4), x.nst, JSON.stringify(x.st));
// мелкий шаг вокруг лучшего прошедшего (если есть)
if (top.length) { const b = top[0]; for (const a of rng(b.a - 1.5, b.a + 1.5, 0.5)) for (const d of rng(b.d - 1.5, b.d + 1.5, 0.5)) for (const w of rng(b.w - 1.5, b.w + 1.5, 0.5)) res.fine.push(run(a, d, w));
  const ok = res.fine.filter((x) => x.ok).length; console.log('мелкий шаг вокруг', b.a, b.d, b.w, ': прошли', ok, 'из', res.fine.length); }
fs.writeFileSync(OUT + '/r3.json', JSON.stringify(res));
