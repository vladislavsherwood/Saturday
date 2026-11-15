/* Круг 15: устойчивость. (а) walk-forward: t, k, rv подбираю по первой половине истории каждой монеты (h1: доход = Σ лог-медиан h1 по отбору, экзамену, 50 сл.),
   проверяю на второй (h2) — к C3 на тех же половинах; ранги. (б) сдвиг исполнения: только сдвиг 0, только 1, только 2 дня (обычно берётся худший из 0 и 1).
   Запуск: node panicx_r15.js */
const H = require('./panicx_p2.js'), P = H.P, Z = H.Z;
const L1 = (m) => Math.log1p(m / 100);
const half = (R, k) => ['sel', 'ex', 'rnd'].reduce((t, g) => t + L1(Z.med(R[g].map((x) => x[k]))), 0);
const B = P.evc(P.base, null), bh1 = half(B, 'h1'), bh2 = half(B, 'h2');
const res = [];
for (const t of [0.97, 0.975, 0.98, 0.985, 0.99]) for (const k of [0, 0.25, 0.5]) for (const rv of [0.955, 0.96, 0.965, 0.97, 0.975]) { if (rv >= t) continue; const R = P.evc(P.base, H.Pol2({ t, k, rv })); res.push({ nm: `t${t} k${k} rv${rv}`, a: half(R, 'h1') - bh1, b: half(R, 'h2') - bh2 }); }
const rk = (arr, key) => { const s = [...arr].sort((x, y) => y[key] - x[key]); return (x) => s.indexOf(x) + 1; };
const ra = rk(res, 'a'), rb = rk(res, 'b');
res.sort((x, y) => y.a - x.a);
console.log('вариант | доход к C3 на 1-х половинах (ранг) | на 2-х половинах (ранг)');
for (const x of res.slice(0, 8)) console.log(x.nm.padEnd(22), x.a.toFixed(3), `(${ra(x)})`, '|', x.b.toFixed(3), `(${rb(x)})`);
for (const nm of ['t0.98 k0.25 rv0.965', 't0.98 k0 rv0.965']) { const x = res.find((y) => y.nm === nm); console.log('—', nm, x.a.toFixed(3), `(${ra(x)})`, '|', x.b.toFixed(3), `(${rb(x)})`); }
const n = res.length, ma = res.reduce((s, x) => s + ra(x), 0) / n; let num = 0, da = 0, db = 0; for (const x of res) { const p = ra(x) - ma, q = rb(x) - ma; num += p * q; da += p * p; db += q * q; }
console.log(`вариантов ${n}; в плюсе на 2-х половинах ${res.filter((x) => x.b > 0).length}; ранговая корреляция 1-я ↔ 2-я ${(num / Math.sqrt(da * db)).toFixed(2)}; лучший по 1-м половинам на 2-х: ${res[0].b.toFixed(3)} (ранг ${rb(res[0])} из ${n})`);
// (б) сдвиг исполнения
const lagMed = (pol, lag) => { const G = H.G, o = {}; for (const g of ['sel', 'ex', 'rnd']) o[g] = Z.med(G[g].map((X) => P.edge(X, P.base, lag, 'full', false, pol).e)); return o; };
for (const lag of [0, 1, 2]) { const b = lagMed(null, lag); const row = [['C3', null], ['panicx-best', H.Pol2()], ['k 0', H.Pol2({ k: 0 })]].map(([nm, pol]) => { const r = pol ? lagMed(pol, lag) : b; const d = ['sel', 'ex', 'rnd'].reduce((t, g) => t + L1(r[g]) - L1(b[g]), 0); return `${nm} ${Math.round(r.sel)}/${Math.round(r.ex)}/${Math.round(r.rnd)} (${d >= 0 ? '+' : ''}${d.toFixed(3)})`; }); console.log(`сдвиг ${lag} дн:`, row.join(' | ')); }
