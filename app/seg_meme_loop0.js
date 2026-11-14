/* Круг 0: список мемов, основа на мемах против DCA и простого удержания (купить всё в первый день), сделки по мемам. Запуск: node app/seg_meme_loop0.js */
const M = require('./seg_meme_lib.js'), K = M.K;
const t0 = Date.now(), G = M.load();
const chk = JSON.stringify(K.withC(K.withC6(K.F), 1.25).rules) === JSON.stringify(M.S0.rules);
console.log('основа = F + C1.25 + C6 из combo_sim:', chk, 'загрузка', ((Date.now() - t0) / 1e3).toFixed(1), 'с');
const r = M.evs(G, M.S0); console.log('оценка', ((Date.now() - t0) / 1e3).toFixed(1), 'с');
const S = M.sum(r);
for (const g in S) for (const k of ['all', 'meme', 'non']) { const a = S[g][k]; console.log(g, k, `n ${a.n} мед ${a.med.toFixed(0)} плюс ${a.pos} половин ${a.hpos} худш ${a.worst.toFixed(0)} худш.пол ${a.hworst.toFixed(0)}`); }
// по мемам: итог к DCA, половины, удержание (лот в первый день) к DCA, вола/бета
for (const g in G) for (const X of G[g].filter((x) => x.meme || (M.BORDER[g] || []).includes(x.name))) {
  const q = r[g].find((x) => x.name === X.name), c = X.c, n = X.n;
  let du = 0; for (let i = 0; i < n; i++) du += 1 / c[i]; const dca = du * c[n - 1], hold = (n / c[0]) * c[n - 1];
  const I = X.ind, vm = med([...I.vol180].filter((v) => v > 0)), bm = med([...I.beta180].filter((v) => !isNaN(v)));
  const tr = K.edge(X, M.S0, 0, 'full', true).tr, nb = tr.filter((t) => t.s > 0).length, ns = tr.filter((t) => t.s < 0).length;
  console.log(`${g} ${X.meme ? 'мем' : 'погран'} ${X.name.padEnd(10)} ${M.day(X, 0)}..${M.day(X, n - 1)} итог ${q.f.toFixed(0)}% (${q.h1.toFixed(0)}/${q.h2.toFixed(0)}) | удержание к DCA ${((hold / dca - 1) * 100).toFixed(0)}% | цена конец/начало ${(c[n - 1] / c[0]).toPrecision(3)} | vol180 ${vm.toFixed(0)} beta180 ${bm.toFixed(2)} | покупок ${nb} продаж ${ns}`);
}
function med(a) { return M.med(a); }
// поведение: медианная вола и бета у мемов и не мемов по группам
for (const g in G) { const vm = (X) => med([...X.ind.vol180].filter((v) => v > 0)), bm = (X) => med([...X.ind.beta180].filter((v) => !isNaN(v)));
  const m = G[g].filter((x) => x.meme), o = G[g].filter((x) => !x.meme);
  console.log(`${g}: vol180 мемы ${med(m.map(vm)).toFixed(0)} (мин ${Math.min(...m.map(vm)).toFixed(0)}) / не мемы ${med(o.map(vm)).toFixed(0)} (макс ${Math.max(...o.map(vm)).toFixed(0)}); beta180 мемы ${med(m.map(bm)).toFixed(2)} / не мемы ${med(o.map(bm)).toFixed(2)}`); }
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(r));
// метрики дна/вершин (agent_sim.metrics): мемы отбора/экзамена/50 случ. против не мемов; 100 новых отдельно
const old = ['sel', 'ex', 'rnd'].flatMap((g) => G[g]);
console.log('мемы (отбор+экз+50):', K.fmtM(K.metrics(old.filter((x) => x.meme), M.S0)));
console.log('не мемы (отбор+экз+50):', K.fmtM(K.metrics(old.filter((x) => !x.meme), M.S0)));
console.log('мемы 100 новых:', K.fmtM(K.metrics(G.n100.filter((x) => x.meme), M.S0)));
console.log('не мемы 100 новых:', K.fmtM(K.metrics(G.n100.filter((x) => !x.meme), M.S0)));
// пропущенные крупные вершины мемов (как в metrics: максимум ±180 дн и ≥2× от минимума прошлого года; нет продажи ±90 дн по цене ≥ 70% вершины)
for (const X of [...old, ...G.n100].filter((x) => x.meme)) { const P = K.metrics([X], M.S0); const tr = K.edge(X, M.S0, 0, 'full', true).tr, MM = X.M;
  for (const i of MM.top) { const hit = tr.some((t) => t.s < 0 && Math.abs(t.i - i) <= 90 && t.p >= 0.7 * X.c[i]); const sold = tr.filter((t) => t.s < 0 && Math.abs(t.i - i) <= 90).reduce((a, t) => a + t.amt, 0);
    console.log(`вершина ${X.name} ${M.day(X, i)} ${hit ? 'продано у вершины' : 'ПРОПУЩЕНА'} (продано ±90 дн на ${sold.toFixed(0)})`); } }
