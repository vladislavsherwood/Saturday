/* Круг 1: можно ли узнать мем по поведению (только прошлое): вола 90/180 дн, бета и корреляция к BTC за 180 дн, рост от 365-дн. минимума.
   Доля дней мемов и не мемов с признаком выше порога, по группам. Запуск: node app/seg_meme_loop1.js */
const M = require('./seg_meme_lib.js');
const G = M.load();
const F = { 'vol120&corr0.5': [0], 'beta90': [1.3, 1.5], vol180: [100, 120, 140], vol90: [100, 120, 150], beta180: [1.3, 1.5], corr180: [-0.6, -0.5] /* < |v| */, 'vol180/beta': [80, 100] };
const val = (X, f, i) => (f === 'vol120&corr0.5' ? (X.ind.vol180[i] > 120 && X.ind.corr180[i] > 0.5 ? 1 : -1) : f === 'corr180' ? -X.ind.corr180[i] : f === 'vol180/beta' ? X.ind.vol180[i] / Math.max(0.3, X.ind.beta180[i]) : X.ind[f][i]);
for (const f in F) for (const v of F[f]) {
  const s = [];
  for (const g in G) { const cnt = { m: [0, 0], o: [0, 0] }, coins = { m: [0, 0], o: [0, 0] };
    for (const X of G[g]) { const k = X.meme ? 'm' : 'o'; let a = 0, b = 0; for (let i = 0; i < X.n; i++) { const x = val(X, f, i); if (isNaN(x) || !x) continue; b++; if (x > v) a++; } cnt[k][0] += a; cnt[k][1] += b; coins[k][1]++; if (b && a / b > 0.5) coins[k][0]++; }
    s.push(`${g}: мемы ${(100 * cnt.m[0] / cnt.m[1]).toFixed(0)}% дней (${coins.m[0]}/${coins.m[1]} монет) не мемы ${(100 * cnt.o[0] / cnt.o[1]).toFixed(0)}% (${coins.o[0]}/${coins.o[1]})`); }
  console.log(`${f} > ${f === 'corr180' ? 'корр < ' + -v : v}: ${s.join(' | ')}`);
}
// по монетам-мемам: медиана vol180 / beta / corr
for (const g in G) console.log(g, G[g].filter((x) => x.meme).map((X) => { const q = (k) => M.med([...X.ind[k]].filter((v) => v && !isNaN(v))); return `${X.name} ${q('vol180').toFixed(0)}/${q('beta180').toFixed(1)}/${q('corr180').toFixed(2)}`; }).join(', '));
for (const g in G) { const o = G[g].filter((x) => !x.meme).map((X) => { const q = (k) => M.med([...X.ind[k]].filter((v) => v && !isNaN(v))); return [X.name, q('vol180'), q('corr180')]; }).filter((x) => x[1] > 120); console.log(g, 'не мемы с медианной волой > 120:', o.map((x) => `${x[0]} ${x[1].toFixed(0)}/${x[2].toFixed(2)}`).join(', ')); }
