/* Агент 4C, круг 10 (по монетам): финальная проверка кандидата против W25 на отборе, экзамене, 50 случайных, 100 новых и металлах;
   половины истории, лучше/хуже по монетам, метрики дна/вершин. Сохраняет found/agent4c-best.json и кандидатов для портфеля.
   Запуск: node app/agent4c_loop10.js <cands.json> */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(['sel', 'ex', 'rnd', 'n100', 'met']);
const mk = (w, v, k) => { const S = A.scale(A.W25, `F${w}_${v}`, 1, k, A.isSell); return { ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((c) => (c.ind === `F${w}_${v}` ? A.c('rel' + w, '<', v) : c)) })) }; };
const C = { W25: A.W25, 'C1.25 (к BTC 180 дн < −15% → продажи ×1,25)': mk(180, -15, 1.25), 'C1.5 (к BTC 180 дн < −15% → продажи ×1,5)': mk(180, -15, 1.5) };
const base = A.ev(G, A.W25), R = {};
const hmed = (g, S, p) => A.med(G[g].map((X) => A.E(X, S, p)));
for (const nm in C) {
  const r = A.ev(G, C[nm]); R[nm] = r;
  console.log(`\n== ${nm}${nm === 'W25' ? '' : ` | к W25: доход ${A.d(r, base).toFixed(3)}, строго ${A.passes(r, base) ? '✔' : '· ' + A.why(r, base)}`}`);
  for (const [g, t] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых'], ['met', 'металлы']]) {
    const [b, w] = A.bw(r, base, g);
    console.log(`  ${t}: ${A.sh(r[g])} | 1-я пол. мед. ${hmed(g, C[nm], 'h1').toFixed(0)}%, 2-я ${hmed(g, C[nm], 'h2').toFixed(0)}%${nm === 'W25' ? '' : ` | лучше/хуже W25: ${b}/${w}`}${g === 'met' ? ' | ' + r.met.e.map((x) => x.toFixed(0)).join('/') : ''}`);
  }
  console.log('  ' + A.fmtM(r.m));
}
fs.writeFileSync(process.argv[2], JSON.stringify(C));
const best = { ...C['C1.25 (к BTC 180 дн < −15% → продажи ×1,25)'] };
best.note = 'Агент 4C: W25 (found/agent2-best.json) + все продажи ×1,25, если монета за 180 дней отстала от BTC больше чем на 15% (условие rel180 < −15 стоит в копии каждого правила продажи перед исходным).';
best.indicators = { rel180: '(close / close 180 дней назад) / (BTC / BTC 180 дней назад) − 1, в процентах; для BTC — 0; нет 180 дней истории — условие не выполнено' };
best.results = Object.fromEntries(Object.entries(R).map(([k, r]) => [k, Object.fromEntries(['sel', 'ex', 'rnd', 'n100', 'met'].map((g) => [g, { med: r[g].med, pos: r[g].pos, n: r[g].n, worst: r[g].worst, hpos: r[g].hpos, hworst: r[g].hworst }]).concat([['metrics', r.m]]))]));
best.aggressive = C['C1.5 (к BTC 180 дн < −15% → продажи ×1,5)'].rules;
fs.writeFileSync(__dirname + '/found/agent4c-best.json', JSON.stringify(best, null, 1));
console.log('\nсохранено: app/found/agent4c-best.json');
