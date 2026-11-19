/* ew: есть ли у фигур Эллиотта прогноз сам по себе — средний лог-доход монеты через 30/90/180 дней после дня сигнала минус средний по всем дням той же монеты
   (среднее по монетам, где сигнал был; 181 монета: отбор, экзамен, 50 случайных, 100 новых). Запуск: node ew_r2.js */
const L = require('./r4_lib.js'), EW = require('./ew_lib.js'), { G } = L;
const XS = []; for (const g of ['sel', 'ex', 'rnd', 'n100']) XS.push(...G[g]);
const H = [30, 90, 180];
function test(nm, src, th, f, o = {}) {
  const acc = H.map(() => []), days = [];
  for (const X of XS) {
    const a = EW.make(X, src, th, f, o), c = X.c, n = X.n; let k = 0;
    H.forEach((h, q) => { let s = 0, m = 0, sa = 0, ma = 0; for (let j = 60; j + h < n; j++) { const r = Math.log(c[j + h] / c[j]); if (!isFinite(r)) continue; sa += r; ma++; if (a[j] > 0.5) { s += r; m++; } } if (m >= 5) acc[q].push(s / m - sa / ma); if (q === 0) k = m; });
    days.push(k);
  }
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length, pos = (v) => v.filter((x) => x > 0).length;
  console.log(`${nm.padEnd(52)} монет ${String(acc[0].length).padStart(3)} дней/монету ${(mean(days)).toFixed(0).padStart(4)} | ` + H.map((h, q) => `${h}д ${(mean(acc[q]) * 100 >= 0 ? '+' : '') + (mean(acc[q]) * 100).toFixed(1)}% (${pos(acc[q])}/${acc[q].length} выше)`).join(' | '));
}
console.log('Сигнал покупки хорош, если после него доход ВЫШЕ обычного; сигнал продажи — если НИЖЕ.');
for (const th of [0.2, 0.35]) {
  test(`1 купить: старт волны 3, зигзаг ${th}`, 'c', th, 'w3start');
  test(`2 продать: идёт волна 5, зигзаг ${th}`, 'c', th, 'w5');
  test(`2 продать: волна 5 + дивергенция RSI, ${th}`, 'c', th, 'w5', { div: 1 });
  test(`3 купить: конец ABC (C ≥ A), ${th}`, 'c', th, 'abc', { m: 1 });
  test(`4 купить: откат 0,618–0,786, ${th}`, 'c', th, 'fib', { a: 0.618, b: 0.786 });
  test(`5 продать: волна 3 ≥ 1,618 × волна 1, ${th}`, 'c', th, 'w3ext', { e: 1.618 });
  test(`6 продать: импульс 5 волн завершён, ${th}`, 'c', th, 'done5');
  test(`7 купить: 5 волн вниз завершены, ${th}`, 'c', th, 'down5');
}
test('9 продать: волна 5 у BTC 25%', 'btc', 0.25, 'w5');
test('9 купить: ABC у BTC 25%', 'btc', 0.25, 'abc', { m: 1 });
test('10 купить: 5 волн вверх у usdt завершены 5%', 'usdt', 0.05, 'done5');
test('10 купить: идёт волна 5 вверх у usdt 5%', 'usdt', 0.05, 'w5');
