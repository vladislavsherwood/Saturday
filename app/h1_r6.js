/* h1, круг 6: продажа путов на резерв (BTC с 2017, ETH с 2019-03, SOL с 2023 — где есть ликвидные опционы), расчётные; премия по Блэку—Шоулзу,
   IV = vrp × реализованная волатильность 30 дн. Варианты: страйк −10/−20/−30%, срок 7/30 дней, номинал 50/100% резерва, vrp 1,0/1,2/1,5.
   Отдельно — доход только по BTC/ETH/SOL (средний лог). Запуск: node h1_r6.js */
const H = require('./h1_lib.js'), { P, Z } = H;
H.head();
const names = ['BTC', 'ETH', 'SOL'];
const by = (o) => { const out = []; for (const g of ['sel']) o.R[g].forEach((x, i) => { if (names.includes(x.name)) { const b = H.bases().BW[g][i]; out.push(`${x.name} ${Math.round(b.f)}→${Math.round(x.f)}`); } }); return out.join(' '); };
for (const vrp of [1.0, 1.2, 1.5]) for (const T of [7, 30]) for (const k of [0.1, 0.2, 0.3]) {
  const o = H.ev(`путы k ${k} T ${T} f 0,5 vrp ${vrp}`, H.mk(H.puts({ k, T, f: 0.5, vrp })), { quiet: true });
  console.log(`${o.txt.slice(0, 150)} | ${by(o)}`);
}
for (const vrp of [1.2, 1.5]) { const o = H.ev(`путы k 0,2 T 30 f 1 vrp ${vrp}`, H.mk(H.puts({ k: 0.2, T: 30, f: 1, vrp })), { quiet: true }); console.log(`${o.txt.slice(0, 150)} | ${by(o)}`); }
