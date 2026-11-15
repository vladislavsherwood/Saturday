/* Круг 18: плато «k 0, выдача × m»: m 1,5…4 × t 0,975/0,98 × rv 0,96/0,965/0,97 × A 540/730 × k 0/0,1. Сравнение — к panicx-best и к C3. Запуск: node panicx_r18.js */
const H = require('./panicx_p2.js');
H.init();
for (const m of [1.5, 1.75, 2, 2.5, 3, 4]) for (const t of [0.975, 0.98]) for (const rv of [0.96, 0.965, 0.97]) for (const A of [540, 730]) for (const k of [0, 0.1]) H.run(`m${m} t${t} rv${rv} A${A} k${k}`, H.Boost(m, { t, rv, A, k }));
console.log(H.summary());
for (const key of ['m', 't', 'rv', 'A', 'k']) { const g = {}; for (const x of H.rows) { const v = x.nm.match(new RegExp(`(?:^| )${key}([0-9.]+)`))[1]; (g[v] = g[v] || []).push(x); } console.log(key, Object.entries(g).map(([v, a]) => `${v}: ✔${a.filter((x) => x.ok).length}/✔C3 ${a.filter((x) => x.ok3).length}/${a.length} ср ${(a.reduce((s, x) => s + x.d, 0) / a.length).toFixed(3)}`).join(' | ')); }
