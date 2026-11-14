/* Круг 4: плато P (мемы: паника → взнос, пока монета ближе X% к своему максимуму за W дней): X × W, мягкая форма (половина доли),
   все покупки резерва вместо только паники, пограничные монеты (APE, ORDI, M) как мемы. Запуск: node app/seg_meme_loop4.js <out.json> */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0), out = [];
const run = (tag, S) => { const r = M.evs(G, S), C = M.cmp(r, b); console.log(M.line(`${tag} | 100н мемы лучше/хуже ${M.bw(r, b, 'n100', (x) => x.meme).join('/')}, все ${M.bw(r, b, 'n100').join('/')}`, r, b)); out.push({ tag, out: C.out, R: C.R }); return r; };
for (const W of [90, 180]) for (const X of [20, 30, 35, 40, 50, 60]) run(`ddm${W} < ${X}`, M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm' + W, '<', X)], 1));
run('ddm90 < 35, половина доли', M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm90', '<', 35)], (r) => 1 + (r.act - 1) / 2));
run('ddm90 < 35, все покупки резерва', M.pre(M.S0, (r) => r.act > 1, [...M.FL.meme, c('ddm90', '<', 35)], 1));
run('ddm90 < 35, кроме возврата', M.pre(M.S0, (r) => r.act > 1 && !M.isRet(r), [...M.FL.meme, c('ddm90', '<', 35)], 1));
// пограничные как мемы
for (const g in G) for (const X of G[g]) if ((M.BORDER[g] || []).includes(X.name)) X.ind.memeb = X.ind.meme.map(() => 1); else X.ind.memeb = X.ind.meme;
const r = run('ddm90 < 35, мемы + APE, ORDI, M', M.pre(M.S0, M.isPanic, [c('memeb', '>', 0.5), c('ddm90', '<', 35)], 1));
console.log('   пограничные:', M.diffMemes(r, b, (x) => ['APE', 'ORDI', 'M'].includes(x.name)));
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
