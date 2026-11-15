/* Круг 12: доля «сразу» от скорости роста usdt: если usdt вырос за 7 дней больше чем на sp — доля kf (откладываем больше), иначе k.
   Контроль — обратное (быстрый рост → откладываем меньше). Запуск: node panicx_r12.js */
const H = require('./panicx_p2.js');
H.init();
const G = H.G; let tot = 0, cnt = {}; // распределение usdt7 в дни отложенной паники
for (const X of [...G.sel, ...G.ex, ...G.rnd]) { const I = X.ind; for (let j = 0; j < X.n; j++) if (I.pday[j] > 0 && I.upk10[j] >= 0.98 && I.usdt[j] <= 1.2 && I.age[j] > 540) { tot++; const b = Math.floor((I.usdt7[j] - 1) * 50) / 50; cnt[b.toFixed(2)] = (cnt[b.toFixed(2)] || 0) + 1; } }
console.log('usdt7−1 в днях отложенной паники:', Object.entries(cnt).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${(100 * v / tot).toFixed(0)}%`).join(' '));
if (!process.argv[2]) for (const sp of [0.02, 0.04, 0.06]) for (const [k, kf] of [[0.25, 0], [0.5, 0], [0.5, 0.25], [0.75, 0.25], [0, 0.25], [0.25, 0.5]]) H.run(`рост>${sp}: k ${k} → ${kf}`, H.Pol2({ sp, k, kf }));
if (!process.argv[2]) console.log(H.summary());
if (process.argv[2] === 'inv') {
  H.rows.length = 0;
  H.run('k 0 везде', H.Pol2({ k: 0 }));
  for (const sp of [0.03, 0.04, 0.05, 0.06, 0.08]) for (const k of [0, 0.1]) for (const kf of [0.25, 0.5]) H.run(`рост>${sp}: k ${k} → ${kf}`, H.Pol2({ sp, k, kf }));
  console.log(H.summary());
}
