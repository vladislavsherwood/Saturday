/* Агент 4E, круг 2: событийный разбор сигналов ВЕРШИНЫ на новых данных (BTC, календарь, с 2018).
   Критерий (заранее): ≥ 4 эпизодов, медиана доходности BTC через 90 дней ниже нуля и ≥ 60% эпизодов в минусе, вход ≥ 80% от максимума ±90 дней,
   на 3 соседних порогах; полезен, если часть эпизодов не накрыта продажами W25 (страх, тихая вершина обе, фандинг BTC > 2%) в ±15 дней.
   Запуск: node app/agent4e_loop2.js */
const E = require('./agent4e_sim.js');
const G = E.groups(['sel']);
const B = G.sel.find((x) => x.name === 'BTC'), n = E.T1 - E.T0 + 1, I = B.ind, C = E.CAL;
const oldTop = new Uint8Array(n), IN = {};
for (const k of Object.keys(I)) IN[k] = new Float64Array(n).fill(NaN);
for (let i = 0; i < B.n; i++) { const d = B.t[i] - E.T0; if (d < 0) continue; for (const k in IN) IN[k][d] = I[k][i];
  oldTop[d] = (I.fng[i] < 52 && I.usdtd[i] < 7.6) || I.qt[i] > 0.5 || I.fund30[i] > 2 || (I.btcath[i] < 15 && I.oth90[i] > 1) ? 1 : 0; }
const near = (d, w = 15) => { for (let j = Math.max(0, d - w); j <= Math.min(n - 1, d + w); j++) if (oldTop[j]) return true; return false; };
const from = E.dayOf('2018-01-01');
console.log(`безусловно BTC с 2018: 30д ${E.baseRet(30, from).toFixed(1)}%, 90д ${E.baseRet(90, from).toFixed(1)}%`);
const out = [];
function test(tag, f, opt = {}) {
  const Ep = E.episodes(f, { from, ...opt }), s = E.sumEp(Ep, 90), s30 = E.sumEp(Ep, 30), nov = Ep.filter((e) => !near(e.d)).length;
  const neg = Ep.filter((e) => e.r90 < 0).length;
  out.push({ tag, ...s, neg, novel: nov });
  console.log(`${tag.padEnd(44)} эп ${String(s.n).padStart(2)} | 30д ${s30.med.toFixed(0)}% | 90д мед ${s.med >= 0 ? '+' : ''}${s.med.toFixed(0)}% в минусе ${neg}/${s.n} | к верш.±90 ${s.toHi.toFixed(0)}% | новых ${nov}`);
  if (opt.show) console.log('    ' + E.fmtEp(Ep));
}
for (const x of [1, 1.5, 2, 3]) test(`фандинг альтов 30д > ${x}%`, (d) => C.afund30[d] > x, { show: x === 2 });
for (const x of [0.5, 0.7, 1]) test(`фандинг альтов 7д > ${x}%`, (d) => C.afund7[d] > x);
for (const x of [1.5, 2, 3]) test(`фандинг ETH 30д > ${x}%`, (d) => C.efund30[d] > x, { show: x === 2 });
for (const x of [1.5, 2, 3]) test(`фандинг BTC 30д > ${x}% (есть в W25 при 2)`, (d) => IN.fund30[d] > x);
for (const x of [0.03, 0.05, 0.08, 0.1]) test(`базис BTC 7д > ${x}%`, (d) => C.prem7b[d] > x, { show: x === 0.05 });
for (const x of [0.03, 0.05, 0.08]) test(`базис ETH 7д > ${x}%`, (d) => C.prem7e[d] > x);
for (const x of [20, 35, 50]) test(`OI ETH за 30д > +${x}%`, (d) => C.eoic30[d] > x);
for (const x of [1.15, 1.25]) test(`лонги/шорты ETH к ср.90 > ${x}`, (d) => C.elsr[d] > x);
for (const x of [1.5, 2, 3]) test(`комиссии BTC 30д/365д > ${x}`, (d) => C.feesr[d] > x, { show: x === 2 });
for (const x of [1.3, 1.6, 2]) test(`выручка майнеров 30д/365д > ${x}`, (d) => C.revr[d] > x);
for (const x of [1.1, 1.2, 1.3]) test(`активные адреса BTC 30д/365д > ${x}`, (d) => C.adrbr[d] > x);
for (const x of [2, 2.5, 3]) test(`MVRV ETH > ${x}`, (d) => C.mvrve[d] > x, { show: x === 2.5 });
for (const x of [2.5, 3, 3.5]) test(`MVRV BTC > ${x} (ряд есть)`, (d) => IN.mvrv[d] > x);
for (const x of [8, 12, 16]) test(`стейблкоины за 30д > +${x}%`, (d) => C.stab30[d] > x);
for (const x of [1, 0, -0.5]) test(`стейблкоины за 30д < ${x}% при BTC < 15% от макс.`, (d) => C.stab30[d] < x && IN.btcath[d] < 15, { show: x === 0 });
for (const x of [3, 4, 5]) test(`доллар за 90д > +${x}%`, (d) => C.dxy90[d] > x, { show: x === 4 });
for (const x of [0.5, 0.75, 1]) test(`доходность 10л за 90д > +${x} п.п.`, (d) => C.y10d90[d] > x, { show: x === 0.75 });
for (const x of [0.5, 0.75]) test(`доходность 2л за 90д > +${x} п.п.`, (d) => C.y2d90[d] > x);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop2.json', JSON.stringify(out));
