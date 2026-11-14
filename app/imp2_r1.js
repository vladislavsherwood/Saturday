/* imp2, круг 1: возврат простаивающего резерва после N дней без сигналов стратегии (без покупок из резерва и продаж).
   Режимы: «каждый день» (доля f резерва в каждый тихий день после N дней) и «разово» (f резерва, затем отсчёт N заново).
   Условия рынка: нет / монета выше средней 200 / BTC выше средней 200 и жадность > 52 / монета на 90-дн. максимуме.
   Первый прогон с N = 60…270 дал ровно основу (такие тихие периоды при резерве > 0 не встречаются: 90% тихих дней с резервом > 30% — ≤ 31 дня после сигнала).
   Запуск: node app/imp2_r1.js <out.json> */
const I = require('./imp2_sim.js'); const fs = require('fs'); const { c } = I;
const G = I.groups(); const base = I.ev(G, I.BASE);
console.log(I.HDR); console.log(I.row('основа', base, base));
const CONDS = { 'без условий': [], 'монета > ср200': [c('sma200', '>', 1)], 'BTC > ср200, жадн>52': [c('bsma200', '>', 1), c('fng', '>', 52)], 'монета на 90-дн макс': [c('hi90', '>', 0.5)] };
const out = [];
for (const [cn, cs] of Object.entries(CONDS)) for (const N of [7, 14, 30, 45]) for (const [mode, fs_] of [['день', [0.01, 0.03]], ['разово', [0.1, 0.25]]]) for (const f of fs_) for (const sh of [0, 0.5]) {
  const S = { ...I.BASE, idle: [{ N, f, sh, conds: cs, reset: mode === 'разово' }] };
  const r = I.ev(G, S, false); const t = `${cn}, N=${N}, ${mode} ${f * 100}%, доля>${sh * 100}%`;
  console.log(I.row(t, r, base)); out.push({ t, d: I.d(r, base), pass: I.passes(r, base), r: I.slim(r), bw: I.bw(r, base, 'n100') });
}
out.sort((a, b) => b.d - a.d); console.log('--- лучшие по доходу'); for (const o of out.slice(0, 12)) console.log(o.d.toFixed(3), o.pass ? '✔' : '·', o.r.n100.toFixed(0), o.bw.join('/'), o.t);
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
