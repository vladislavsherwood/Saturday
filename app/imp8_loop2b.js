/* imp8, круг 2б: хрупкие пороги — плато fng<52, fund30>2, oth90>1 и замена абсолютного usdtd<7,6 (по сути фильтр 2022–23 и 2026)
   на относительный: usdtd / максимум usdtd за 365 дней (umx) или usdtd / средняя за 365 дней (usma). Запуск: node app/imp8_loop2b.js */
const I = require('./imp8_sim.js'); const { K } = I;
const G = I.load(); const S2 = I.simplify(); const base = K.ev(G, S2, false);
const roll = (a, w, f) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = f === 'max' ? -Infinity : 0, k = 0; for (let j = Math.max(0, i - w + 1); j <= i; j++) { if (isNaN(a[j])) continue; if (f === 'max') m = Math.max(m, a[j]); else m += a[j]; k++; } o[i] = k < w * 0.8 ? NaN : f === 'max' ? m : m / k; } return o; };
for (const g in G) for (const X of G[g]) { const u = X.ind.usdtd; const mx = roll(u, 365, 'max'), sm = roll(u, 365, 'sma'); X.ind.umx = u.map((v, i) => v / mx[i]); X.ind.usma = u.map((v, i) => v / sm[i]); }
const sh = (t, S) => { const r = K.ev(G, S, false); console.log(`${K.d(r, base) >= 0 ? '+' : ''}${K.d(r, base).toFixed(3)} ${K.passes(r, base) ? '✔' : '·'} ${K.line(r)} | ${t} | ${K.why(r, base).slice(0, 120)}`); return r; };
const setThr = (S, ind, op, v0, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((y) => (y.ind === ind && y.op === op && y.v === v0 ? { ...y, v } : y)) })) });
for (const v of [48, 50, 51, 53, 54, 55, 57, 60]) sh('fng<' + v, setThr(S2, 'fng', '<', 52, v));
for (const v of [1.5, 1.8, 2.2, 2.5, 3]) sh('fund30>' + v, setThr(S2, 'fund30', '>', 2, v));
for (const v of [0.6, 0.8, 0.9, 1.05, 1.1]) sh('oth90>' + v, setThr(S2, 'oth90', '>', 1, v));
for (const v of [7, 7.2, 7.4, 7.8, 8]) sh('usdtd<' + v, setThr(S2, 'usdtd', '<', 7.6, v));
const repl = (S, ind, op, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((y) => (y.ind === 'usdtd' ? { ind, op, v } : y)) })) });
for (const v of [0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.99]) sh('umx<' + v, repl(S2, 'umx', '<', v));
for (const v of [1.0, 1.05, 1.1, 1.15, 1.2, 1.3]) sh('usma<' + v, repl(S2, 'usma', '<', v));
