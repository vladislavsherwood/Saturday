/* Круг 2: широкая тихая вершина продаёт мемы слишком рано — меньше продавать (×0 / ×0,25 / ×0,5 / ×0,75 от размера основы) для всех / мемов / беты > 1,3 / > 1,5.
   Запуск: node app/seg_meme_loop2.js <out.json> */
const M = require('./seg_meme_lib.js');
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0), out = [];
for (const f of ['all', 'meme', 'b13', 'b15']) for (const k of (process.env.K || '0,0.25,0.5,0.75').split(',').map(Number)) {
  const S = M.pre(M.S0, M.isWide, M.FL[f], (r) => (k === 0 ? 1 : +(r.act * k).toFixed(6)));
  const r = M.evs(G, S), C = M.cmp(r, b);
  console.log(M.line(`широкая ×${k} [${f}] | 100н мемы лучше/хуже ${M.bw(r, b, 'n100', (x) => x.meme).join('/')}, все ${M.bw(r, b, 'n100').join('/')}`, r, b));
  out.push({ f, k, out: C.out, R: C.R });
}
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
