/* tune4: перебор параметров по кругам. Запуск: node app/tune4_loop.js <круг> [JSON базовых P]
   Пишет scratchpad/tune4/r<круг>.json. Наборы перебора — в SETS. */
const T = require('./tune4_sim.js'); const fs = require('fs');
const DIR = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune4';
const R = T.rng;
const SETS = {
  1: { qs: R(0.30, 0.50, 0.005), ws: R(0.40, 0.60, 0.005), rs: R(0.05, 0.15, 0.005), ps: R(0.05, 0.15, 0.005), asz: R(0.05, 0.15, 0.005) },
  2: { qa: R(8, 12, 0.25), qo: R(1.2, 1.8, 0.05), wa: R(12, 18, 0.25), wo: R(0.7, 1.3, 0.05) },
  3: { bqq: R(1.2, 1.8, 0.025), bqw: R(1.2, 1.8, 0.025), a1k: R(1.0, 1.5, 0.025) },
  4: { rD: R(35, 55, 1), rf: R(48, 56, 0.5), pa: R(17, 25, 0.5), pu: R(250, 350, 5), asf: R(61, 69, 0.5), aso: R(0.7, 1.3, 0.05) },
};
const k = process.argv[2]; const P = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const G = T.load(); const out = { P, sweeps: {} };
for (const [n, vals] of Object.entries(SETS[k] || JSON.parse(process.env.SETS))) { console.log('--', n); out.sweeps[n] = T.sweep(G, n, vals, P); }
fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(`${DIR}/r${k}.json`, JSON.stringify(out));
