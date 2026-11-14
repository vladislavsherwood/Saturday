/* Круг 6: молодые мемы — продажи на страхе в первые N дней истории монеты распродают её начальный рост. Продажи страха/сильного страха ×k,
   пока agei < N (дней от начала ряда), для мемов / всех; поверх основы и P35. Запуск: node app/seg_meme_loop6.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
const P35 = M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm90', '<', 35)], 1), bp = M.evs(G, P35);
const isFear = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'usdtd');
for (const f of ['meme', 'all']) for (const N of [90, 180, 365]) for (const k of [0, 0.5]) {
  const mk = (S) => M.pre(S, isFear, [...M.FL[f], c('agei', '<', N)], (r) => (k === 0 ? 1 : +(r.act * k).toFixed(6)));
  const r = M.evs(G, mk(M.S0));
  console.log(M.line(`страх ×${k} в первые ${N} дн [${f}] | ${M.rs(M.robust(r, b))}`, r, b));
  if (f === 'meme') { const rp = M.evs(G, mk(P35)); console.log(`   поверх P35: ${M.rs(M.robust(rp, bp))} | все ${M.cmp(rp, bp).out.all.inc.toFixed(3)}`); if (k === 0.5) console.log('   ', M.diffMemes(r, b)); }
}
