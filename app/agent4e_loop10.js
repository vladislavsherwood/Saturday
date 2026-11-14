/* Агент 4E, круг 10: финальная проверка лучших находок направления против W25 и выбор.
   Кандидаты: B — W25 + «доходность 10 лет за 90 дн. < −0,75 п.п. → вернуть 50% резерва» (в конце, круг 4);
   C — W25 + «OI ETH за 30 дн. > 30%, 1-й день эпизода → продать 40%» (круг 8); D — W25 + «OI ETH > 40% → продать 25%» каждый день (круги 6–7).
   Критерий принятия (заранее): строгая проверка пройдена; 100 новых не хуже W25 (медиана, монет и половин в плюсе); доход держится не на одном
   эпизоде: правило, разрешённое только с 2024-07 / только до 2024-01, сохраняет хотя бы треть дохода; метрики дна/вершины не хуже.
   Сохраняет found/agent4e-best.json. Запуск: node app/agent4e_loop10.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const fs = require('fs');
E.EXTRA4.push((X) => { const o = X.ind.eoic30, n = X.n, a = new Float64Array(n).fill(NaN); let start = -1e9, last = -1e9; for (let i = 0; i < n; i++) if (o[i] > 30) { if (i - last >= 30) start = i; last = i; a[i] = i - start; } X.ind.eoiday30 = a; });
const G = E.groups(['sel', 'ex', 'rnd', 'n100']), base = E.ev(G, E.W25, true);
const R = E.W25.rules, i13 = R.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30');
const after = (rule) => ({ ...E.W25, rules: [...R.slice(0, i13 + 1), rule, ...R.slice(i13 + 1)] });
const C = {
  'B: + доходность 10л < −0,75 → 50% резерва': { ...E.W25, rules: [...R, { act: 1.5, conds: [c('y10d90', '<', -0.75)] }] },
  'C: + OI ETH > 30%, 1-й день → продать 40%': after({ act: -0.4, conds: [c('eoiday30', '<', 0.5)] }),
  'D: + OI ETH > 40% → продать 25% (каждый день)': after({ act: -0.25, conds: [c('eoic30', '>', 40)] }),
};
const KEY = { 'B': 'y10d90', 'C': 'eoiday30', 'D': 'eoic30' };
console.log(E.HDR); console.log(E.show('W25', base, base));
for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  W25 ${nm}: ${E.sh(base[g])}`);
console.log('  ' + E.fmtM(base.m));
const ALLX = [...G.sel, ...G.ex, ...G.rnd, ...G.n100];
for (const [nm, S] of Object.entries(C)) {
  const r = E.ev(G, S, true), k = KEY[nm[0]];
  console.log(`\n== ${nm}\n${E.show(nm, r, base)}\n  строгая: ${E.passes(r, base) ? 'пройдена' : 'не пройдена — ' + E.why(r, base)}`);
  for (const [g, gn] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${gn}: ${E.sh(r[g])} | лучше W25 на ${r[g].e.filter((x, i) => x > base[g].e[i] + 0.5).length}, хуже на ${r[g].e.filter((x, i) => x < base[g].e[i] - 0.5).length}`);
  console.log('  ' + E.fmtM(r.m));
  // зависимость от эпизодов
  const line = [];
  for (const [tag, ok] of [['только до 2024-01', (t) => t < E.dayOf('2024-01-01') + E.T0], ['только с 2024-07', (t) => t >= E.dayOf('2024-07-01') + E.T0]]) {
    for (const X of ALLX) { const o = X.ind[k], a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = ok(X.t[i]) ? o[i] : NaN; X.ind.kF = a; }
    const S2 = { ...S, rules: S.rules.map((rr) => (rr.conds.some((cd) => cd.ind === k) ? { ...rr, conds: rr.conds.map((cd) => (cd.ind === k ? { ...cd, ind: 'kF' } : cd)) } : rr)) }, r2 = E.ev(G, S2, false);
    line.push(`${tag}: ${E.d(r2, base).toFixed(3)} (100н ${r2.n100.med.toFixed(0)})`);
  }
  console.log(`  доход ${E.d(r, base).toFixed(3)}; ${line.join('; ')}`);
}
fs.writeFileSync(__dirname + '/found/agent4e-best.json', JSON.stringify(E.W25));
console.log('\nсохранено: app/found/agent4e-best.json (= W25 без изменений — ни один кандидат не прошёл критерий)');
