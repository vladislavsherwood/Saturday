/* Агент 4A, к кругу 4: разбор дней покупок на панике (#3, #5, #9) — где дно ещё впереди.
   Для каждой покупки резерва этих правил (81 монета) берём признаки дня решения и смотрим, насколько цена выше минимума следующих
   90 дней и доход монеты через 90/180 дней (будущее — только для оценки). Признаки делим на трети. Запуск: node app/agent4a_ev4.js */
const A = require('./agent4a_sim.js');
const G = A.groups(['sel', 'ex', 'rnd']);
const coins = [...G.sel, ...G.ex, ...G.rnd], P = [3, 5, 9];
const F = ['lsr', 'fund7', 'fund30', 'btcdays', 'btcath', 'oidd30', 'flush10', 'fng', 'fngd7', 'btcr30', 'btcr90', 'cmin30', 'cmin90', 'rsi', 'sma200', 'usdtd', 'mvrv', 'taker7', 'panicd', 'tlsr', 'div', 'oic7', 'bp7', 'usdt', 'othd', 'btcd90', 'vol30'];
const rows = [];
for (const X of coins) {
  const { tr } = A.edge(X, A.W25, 0, 'full', true), c = X.c;
  for (const t of tr) if (t.s > 0 && P.includes(t.q)) {
    let m = Infinity; for (let k = t.i; k <= Math.min(X.n - 1, t.i + 90); k++) m = Math.min(m, c[k]);
    const f90 = t.i + 90 < X.n ? c[t.i + 90] / t.p - 1 : NaN, f180 = t.i + 180 < X.n ? c[t.i + 180] / t.p - 1 : NaN;
    const o = { amt: t.amt, ab: t.p / m - 1, f90, f180, q: t.q }; for (const k of F) o[k] = X.ind[k] ? X.ind[k][t.i - 1] : NaN; rows.push(o);
  }
}
console.log(`покупок: ${rows.length}`);
const wm = (R, k) => { let s = 0, w = 0; for (const r of R) if (!isNaN(r[k])) { s += r.amt * r[k]; w += r.amt; } return w ? s / w : NaN; };
for (const k of F) {
  const R = rows.filter((r) => !isNaN(r[k]) && isFinite(r[k])).sort((a, b) => a[k] - b[k]); if (R.length < 100) continue;
  const parts = [R.slice(0, R.length / 3 | 0), R.slice(R.length / 3 | 0, 2 * R.length / 3 | 0), R.slice(2 * R.length / 3 | 0)];
  console.log(`${k.padEnd(8)} ` + parts.map((p) => `[${p[0][k].toFixed(2)}…${p[p.length - 1][k].toFixed(2)}] выше мин90 ${(100 * wm(p, 'ab')).toFixed(0)}% через 90д ${(100 * wm(p, 'f90')).toFixed(0)}% 180д ${(100 * wm(p, 'f180')).toFixed(0)}%`).join(' | '));
}
