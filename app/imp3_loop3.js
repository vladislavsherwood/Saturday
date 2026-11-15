/* imp3, круг 3: порог USDT.D 7,6% как абсолютный уровень → относительный.
   Доля USDT растёт по годам (2018 ~1%, 2021 ~3%, 2023 ~7%, 2026 8–9%), поэтому «usdtd < 7,6» запрещает продажи на страхе только в 2022-11…2023
   и в 2026, а в 2018–21 не работает вовсе. Гипотеза: относительный порог (usdtd к средней за 180/365 дней или к максимуму за 365 дней) лучше
   отделяет капитуляцию (бегство в стейблы — не продавать) от обычного страха во всей истории. Варианты: только в правилах продаж на страхе;
   во всех правилах с usdtd < 7,6; «и» / «или» с абсолютным порогом. Запуск: node app/imp3_loop3.js <out.json> */
const Z = require('./imp3_sim.js');
const fs = require('fs');
const { c, K } = Z;
const G = Z.load();
const sma = (a, w) => { const n = a.length, o = new Float64Array(n); let s = 0, k = 0; for (let i = 0; i < n; i++) { if (!isNaN(a[i])) { s += a[i]; k++; } if (i >= w && !isNaN(a[i - w])) { s -= a[i - w]; k--; } o[i] = i >= w - 1 && k > w * 0.8 ? a[i] / (s / k) : NaN; } return o; };
const mx = (a, w) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] > m) m = a[j]; o[i] = i >= w - 1 ? a[i] / m : NaN; } return o; };
for (const g in G) for (const X of G[g]) { const u = X.ind.usdtd; X.ind.usr180 = sma(u, 180); X.ind.usr365 = sma(u, 365); X.ind.usx365 = mx(u, 365); }
const base = Z.ev(G, Z.BASE), out = [], run = Z.runner(G, base, out);
console.log(Z.row('ОСНОВА', base, base));
// в правилах fear: заменить (rep) или добавить (and) условие; «или» — копия правила с относительным условием вместо абсолютного перед исходным
const onFear = (S, f) => ({ ...S, rules: S.rules.flatMap((r) => (Z.isFear(r) ? f(r) : [r])) });
const swapIn = (r, cd) => ({ ...r, conds: r.conds.map((x) => (x.ind === 'usdtd' ? cd : x)) });
for (const [ind, vs] of [['usr180', [1.1, 1.2, 1.3, 1.5]], ['usr365', [1.1, 1.2, 1.3, 1.5, 1.7]], ['usx365', [0.8, 0.9, 0.95, 0.999]]]) for (const v of vs) {
  const cd = c(ind, '<', v);
  run(`страх: usdtd<7,6 → ${ind}<${v}`, onFear(Z.BASE, (r) => [swapIn(r, cd)]));
  run(`страх: usdtd<7,6 и ${ind}<${v}`, onFear(Z.BASE, (r) => [{ ...r, conds: [...r.conds, cd] }]));
  run(`страх: usdtd<7,6 или ${ind}<${v}`, onFear(Z.BASE, (r) => [r, swapIn(r, cd)]));
  run(`все правила: usdtd<7,6 → ${ind}<${v}`, { ...Z.BASE, rules: Z.BASE.rules.map((r) => swapIn(r, r.conds.some((x) => x.ind === 'usdtd') ? cd : null)) });
}
// контроль: другой абсолютный порог
for (const v of [6.5, 7, 8, 9, 100]) run(`страх: usdtd < ${v}`, onFear(Z.BASE, (r) => [swapIn(r, c('usdtd', '<', v))]));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
