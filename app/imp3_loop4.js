/* imp3, круг 4: продавать на страхе раз в N дней страха вместо каждого дня.
   Гипотеза: каждый день страха продаёт и на внутриэпизодных отскоках вниз, и у локальных минимумов; продажа раз в N дней страха (N = 2/3/5/7)
   долей, равной N дневным (1 − (1 − s)^N, «тот же объём»), или долей s·k (меньше/больше) — меньше комиссий и шум дня, а объём тот же.
   Остальные дни страха: только взнос остаётся в кэше (как в день продажи) или покупается (обычный день). Также вариант «по календарю»:
   день эпизода (fepd) кратен N. Запуск: node app/imp3_loop4.js <out.json> */
const Z = require('./imp3_sim.js');
const fs = require('fs');
const { c } = Z;
const G = Z.load();
Z.addEp(G, 14);
const NS = [2, 3, 5, 7, 10];
for (const g in G) for (const X of G[g]) for (const N of NS) { const a = X.ind.fepn14, d = X.ind.fepd14, o = new Float64Array(X.n), od = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { o[i] = isNaN(a[i]) ? NaN : (a[i] - 1) % N; od[i] = isNaN(d[i]) ? NaN : d[i] % N; } X.ind['fm' + N] = o; X.ind['fdm' + N] = od; }
const base = Z.ev(G, Z.BASE), out = [], run = Z.runner(G, base, out);
console.log(Z.row('ОСНОВА', base, base));
// на страхе: в день «fm < 0,5» (1-й, N+1-й … день страха) — продажа с долей f(s), в прочие дни — act rest
const every = (ind, f, rest) => ({ ...Z.BASE, rules: Z.BASE.rules.flatMap((r) => (Z.isFear(r) ? [{ act: -Math.min(1, f(-r.act)), conds: [...r.conds, c(ind, '<', 0.5)] }, { act: rest, conds: r.conds }] : [r])) });
for (const N of NS) for (const [nm, f] of [['тот же объём', (s) => 1 - (1 - s) ** N], ['s·N/2', (s) => (s * N) / 2], ['s·N', (s) => s * N]]) for (const rest of [0, 1]) {
  run(`раз в ${N} дней страха, ${nm}, прочие дни ${rest ? 'взнос в монету' : 'взнос в кэш'}`, every('fm' + N, f, rest));
  if (nm === 'тот же объём') run(`по календарю раз в ${N} дн эпизода, ${nm}, прочие ${rest ? 'взнос в монету' : 'в кэш'}`, every('fdm' + N, f, rest));
}
// контроль: прежняя доля каждый день, но взнос в дни продажи — в монету (не в кэш)
fs.writeFileSync(process.argv[2], JSON.stringify(out));
