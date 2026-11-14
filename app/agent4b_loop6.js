/* Агент 4B, круг 6: продажа альта на собственном пампе посреди медвежьего рынка BTC.
   Наблюдение круга 0: треть пропущенных крупных вершин — вершины альта при BTC в 20–55% ниже максимума (WEMIX 2023-12, POLY 2023-10,
   RGT 2023-07, HTR/SEI/TIBBIR 2026-09): ни один рыночный сигнал вершины не горит. Прошлые агенты: перегрев монеты в любое время
   (RSI, ×средней 200, +60–100% за 30 дней) хуже на 100 новых. Новое: только при медвежьем BTC (btcath > 20/35%), где памп альта —
   чаще ловушка. Правило: «BTC ниже максимума > b% и монета выше 90-дн. минимума > u% → продать s» (в конце списка).
   База сравнения — W25 и R50 (круг 5). Критерий: строгая ✔ к своей базе, доход > +0,03, соседи в плюсе, пропущено вершин меньше.
   Запуск: node app/agent4b_loop6.js */
const B = require('./agent4b_sim.js'), K = require('./agent4b_cand.js');
const { c } = B;
const G = B.groups(); K.prep(G);
const base = B.ev(G, B.W25), R50 = K.R(0.5, 0.1, 45), r50 = B.ev(G, R50);
const rows = []; const run = (tag, S, b) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, b); rows.push(r); console.log(B.show(tag, r, b) + (B.passes(r, b) ? '' : ' | ' + B.why(r, b))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base)); console.log(B.show('R50 к W25', r50, base));
for (const [nm, S0, b] of [['W25', B.W25, base], ['R50', R50, r50]]) {
  console.log(`\n== к ${nm}`);
  for (const bt of [20, 35]) for (const u of [100, 200, 400]) for (const s of [0.1, 0.25]) run(`${nm} + BTC ниже макс. > ${bt}%, монета +${u}% от 90-дн. мин. → ${s * 100}%`, B.ins(S0, [{ act: -s, conds: [c('btcath', '>', bt), c('up90', '>', u)] }]), b);
}
require('fs').writeFileSync(B.SCR + '/agent4b_loop6.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, m: r.m, n100: r.n100.med }))));
