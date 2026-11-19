/* ew, 10 идей по волнам Эллиотта поверх combo4. Признаки — ew_lib.js (зигзаг по закрытиям, развороты только подтверждённые).
   Каждое правило — в двух местах: «первым» (главнее остальных правил) и «последним» (только дни обычного взноса). Критерий (заранее): доход > 0 и строгая ✔,
   затем соседи и 100 новых. Запуск: node ew_r1.js > scratchpad/ew/r1.log */
const L = require('./r4_lib.js'), { S0, c } = L, EW = require('./ew_lib.js');
const made = new Set();
const ind = (src, th, f, o = {}) => { const nm = `ew_${src}_${th}_${f}_${JSON.stringify(o).replace(/\W/g, '')}`; if (!made.has(nm)) { L.addInd(nm, (X) => EW.make(X, src, th, f, o)); made.add(nm); } return nm; };
const bigdn = (th) => { const nm = `ew_dir_${th}`; if (!made.has(nm)) { L.addInd(nm, (X) => { const z = EW.zz(X.c, th), a = new Float64Array(X.n); for (let j = 0; j < X.n; j++) a[j] = z.dir[j] === -1 ? 1 : 0; return a; }); made.add(nm); } return nm; };
const res = [];
function T(idea, nm, act, conds) {
  for (const pl of ['первым', 'последним']) {
    const S = L.clone(), r = { act, conds }; if (pl === 'первым') S.rules.unshift(r); else S.rules.push(r);
    const o = L.run(`${idea}. ${nm} [${pl}]`, S, L.pol0, { quiet: true }); res.push({ idea, nm: `${nm} [${pl}]`, inc: o.dseg.all, ok: !o.w, txt: o.txt, S });
    console.log(o.txt.slice(0, 200));
  }
}
const on = (nm) => [c(nm, '>', 0.5)];
L.run('combo4', S0);
const TH = [0.2, 0.35];
console.log('— 1. старт волны 3 (откат волны 2 0,382–0,786, пробой вершины волны 1) → купить —');
for (const th of TH) for (const f of [0.05, 0.15]) T(1, `зигзаг ${th * 100}%, +${f * 100}% резерва`, 1 + f, on(ind('c', th, 'w3start')));
console.log('— 2. идёт волна 5 → продавать (вариант: строго без перекрытия волн 1 и 4; с дивергенцией RSI) —');
for (const th of TH) for (const s of [0.03, 0.1]) T(2, `зигзаг ${th * 100}%, −${s * 100}%`, -s, on(ind('c', th, 'w5')));
for (const th of TH) T(2, `зигзаг ${th * 100}%, без перекрытия, −5%`, -0.05, on(ind('c', th, 'w5', { ov: 1 })));
for (const th of TH) T(2, `зигзаг ${th * 100}%, дивергенция RSI, −5%`, -0.05, on(ind('c', th, 'w5', { div: 1 })));
console.log('— 3. конец коррекции ABC (C ≥ m × A) → купить —');
for (const th of TH) for (const m of [1, 1.618]) T(3, `зигзаг ${th * 100}%, C ≥ ${m}A, +10%`, 1.1, on(ind('c', th, 'abc', { m })));
console.log('— 4. откат Фибоначчи от последней ноги вверх → купить —');
for (const th of TH) for (const [a, b] of [[0.5, 0.618], [0.618, 0.786], [0.786, 1]]) T(4, `зигзаг ${th * 100}%, откат ${a}–${b}, +5%`, 1.05, on(ind('c', th, 'fib', { a, b })));
console.log('— 5. цель волны 3 (≥ e × волна 1 от дна волны 2) → продать —');
for (const th of TH) for (const e of [1.618, 2.618]) T(5, `зигзаг ${th * 100}%, ${e} × волна 1, −5%`, -0.05, on(ind('c', th, 'w3ext', { e })));
console.log('— 6. импульс из 5 волн завершён, первая нога вниз → продать —');
for (const th of TH) for (const s of [0.03, 0.1]) T(6, `зигзаг ${th * 100}%, −${s * 100}%`, -s, on(ind('c', th, 'done5')));
console.log('— 7. пять волн вниз завершены, первая нога вверх → купить —');
for (const th of TH) for (const f of [0.05, 0.15]) T(7, `зигзаг ${th * 100}%, +${f * 100}%`, 1 + f, on(ind('c', th, 'down5')));
console.log('— 8. две степени: большая коррекция (зигзаг 50%) + малые пять волн вниз (15/20%) → купить —');
for (const sm of [0.15, 0.2]) for (const f of [0.05, 0.15]) T(8, `большая 50%, малая ${sm * 100}%, +${f * 100}%`, 1 + f, [c(bigdn(0.5), '>', 0.5), c(ind('c', sm, 'down5'), '>', 0.5)]);
console.log('— 9. волны BTC для всех монет: волна 5 у BTC → продать; ABC у BTC → купить —');
for (const th of [0.15, 0.25]) { T(9, `BTC ${th * 100}%: волна 5 → −5%`, -0.05, on(ind('btc', th, 'w5'))); T(9, `BTC ${th * 100}%: ABC (C ≥ A) → +10%`, 1.1, on(ind('btc', th, 'abc', { m: 1 }))); }
console.log('— 10. волны доли стейблов (usdt): пять волн вверх завершены / идёт волна 5 вверх → купить —');
for (const th of [0.05, 0.08]) { T(10, `usdt ${th * 100}%: 5 волн вверх завершены → +10%`, 1.1, on(ind('usdt', th, 'done5'))); T(10, `usdt ${th * 100}%: идёт волна 5 вверх → +10%`, 1.1, on(ind('usdt', th, 'w5'))); }
console.log('\nЛучшее по каждой идее:');
for (let i = 1; i <= 10; i++) { const a = res.filter((r) => r.idea === i).sort((x, y) => y.inc - x.inc)[0]; console.log(`${i}. ${a.nm}: доход ${a.inc >= 0 ? '+' : ''}${a.inc.toFixed(3)} ${a.ok ? '✔' : '✗'}`); }
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(res.map(({ idea, nm, inc, ok }) => ({ idea, nm, inc, ok }))));
