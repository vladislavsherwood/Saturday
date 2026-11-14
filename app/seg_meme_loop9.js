/* Круг 9: сочетание P (X = 30/35/40) × CM (×1,5/×2/×2,5) — плато; выбранный P35 + CM2 против основы по всем группам, по мемам и не мемам,
   метрики дна/вершин; сохраняет правила для стенда маржи. Запуск: node app/seg_meme_loop9.js <rules_out.json> */
const M = require('./seg_meme_lib.js'), K = M.K;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
for (const X of [30, 35, 40]) for (const k of [1.5, 2, 2.5]) { const r = M.evs(G, M.cand(X, k)); const C = M.cmp(r, b).out;
  console.log(`P${X} + CM${k}: доход все ${C.all.inc.toFixed(3)}${C.all.pass ? '✔' : '·' + C.all.why} мемы ${C.meme.inc.toFixed(3)}${C.meme.pass ? '✔' : '·' + C.meme.why} не мемы ${C.non.inc.toFixed(3)} | ${M.rs(M.robust(r, b))}`); }
const S = M.cand(35, 2), r = M.evs(G, S);
console.log('\n' + M.line(`ВЫБОР P35 + CM2 к основе | ${M.rs(M.robust(r, b))}`, r, b));
console.log('   по мемам:', M.diffMemes(r, b));
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`   ${g}: все лучше/хуже ${M.bw(r, b, g).join('/')}; мемы ${M.bw(r, b, g, (x) => x.meme).join('/')}; не мемы ${M.bw(r, b, g, (x) => !x.meme).join('/')}`);
// стандартные цифры (agent_sim.evalAll) для всей выборки: медианы, в плюсе, половины, худшие
const R0 = K.ev(G, M.S0, false), R1 = K.ev(G, S, false);
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`   ${g}: основа ${K.sh(R0[g])}\n        выбор  ${K.sh(R1[g])}`);
const old = ['sel', 'ex', 'rnd'].flatMap((g) => G[g]);
for (const [t, A] of [['мемы старые', old.filter((x) => x.meme)], ['не мемы старые', old.filter((x) => !x.meme)], ['мемы 100н', G.n100.filter((x) => x.meme)]]) {
  console.log(`   метрики ${t}: основа ${K.fmtM(K.metrics(A, M.S0))}\n                 выбор ${K.fmtM(K.metrics(A, S))}`); }
require('fs').writeFileSync(process.argv[2], JSON.stringify({ base: S.base, rules: S.rules }));
