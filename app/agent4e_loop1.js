/* Агент 4E, круг 0 + круг 1.
   Круг 0: W25 на стенде с новыми рядами (должно совпасть: 1890 / 1158 / 284 / 304).
   Круг 1: событийный разбор сигналов ДНА на новых данных (по BTC и ETH, календарь).
   Критерий (заранее): сигнал годится, если ≥ 4 эпизодов, медиана доходности BTC через 90 дней выше безусловной и в плюсе ≥ 70% эпизодов,
   и это держится на 3 соседних порогах (плато); полезен, если заметная доля эпизодов НЕ накрыта нынешними сигналами дна
   (страх < 10, паника usdt > 1,07 и othd < 25, вынос OI < −28%) в ±15 дней.
   Запуск: node app/agent4e_loop1.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const G = E.groups(), w25 = E.ev(G, E.W25), main = E.ev(G, E.MAIN);
console.log(E.HDR); console.log(E.show('основа', main, main)); console.log(E.show('W25', w25, main));
for (const [g, nm] of [['sel', 'отбор'], ['ex', 'экзамен'], ['rnd', '50 случ.'], ['n100', '100 новых']]) console.log(`  W25 ${nm}: ${E.sh(w25[g])}`);
console.log('  ' + E.fmtM(w25.m));

// календарь существующих сигналов по BTC (со страницы отбора)
const B = G.sel.find((x) => x.name === 'BTC'), n = E.T1 - E.T0 + 1, I = B.ind;
const oldBot = new Uint8Array(n), oldTop = new Uint8Array(n), IN = {};
for (const k of Object.keys(I)) IN[k] = new Float64Array(n).fill(NaN);
for (let i = 0; i < B.n; i++) { const d = B.t[i] - E.T0; if (d < 0) continue; for (const k in IN) IN[k][d] = I[k][i];
  oldBot[d] = I.fng[i] < 10 || (I.usdt[i] > 1.07 && I.othd[i] < 25) || I.oidd30[i] < -28 ? 1 : 0;
  oldTop[d] = (I.fng[i] < 52 && I.usdtd[i] < 7.6) || I.qt[i] > 0.5 || I.fund30[i] > 2 || (I.btcath[i] < 15 && I.oth90[i] > 1) ? 1 : 0; }
const near = (arr, d, w = 15) => { for (let j = Math.max(0, d - w); j <= Math.min(n - 1, d + w); j++) if (arr[j]) return true; return false; };
const C = E.CAL;
const v = (k) => (d) => (C[k] ? C[k][d] : IN[k][d]);
const from = E.dayOf('2018-01-01');
console.log(`\nбезусловно BTC с 2018: 30д ${E.baseRet(30, from).toFixed(1)}%, 90д ${E.baseRet(90, from).toFixed(1)}%, 180д ${E.baseRet(180, from).toFixed(1)}%; с 2020: 90д ${E.baseRet(90, E.dayOf('2020-01-01')).toFixed(1)}%`);
const out = [];
function test(tag, f, opt = {}) {
  const Ep = E.episodes(f, { from, ...opt }), s = E.sumEp(Ep, 90), s180 = E.sumEp(Ep, 180), nov = Ep.filter((e) => !near(opt.top ? oldTop : oldBot, e.d)).length;
  const r = { tag, ...s, med180: s180.med, novel: nov }; out.push(r);
  console.log(`${tag.padEnd(46)} эп ${String(s.n).padStart(2)} | 90д мед ${s.med >= 0 ? '+' : ''}${s.med.toFixed(0)}% в плюсе ${s.pos}/${s.n} | 180д ${s180.med.toFixed(0)}% | от дна±90 +${s.fromLo.toFixed(0)}% | к верш. ${s.toHi.toFixed(0)}% | новых ${nov}`);
  if (opt.show) console.log('    ' + E.fmtEp(Ep));
  return Ep;
}
console.log('\n== Круг 1: сигналы дна (вход в первый день эпизода, BTC) ==');
for (const x of [-0.5, -0.2, 0, 0.1, 0.2]) test(`фандинг альтов 30д < ${x}%`, (d) => C.afund30[d] < x, { show: x === 0 });
for (const x of [-0.3, -0.1, 0]) test(`фандинг альтов 7д < ${x}%`, (d) => C.afund7[d] < x);
for (const x of [-0.5, 0, 0.2]) test(`фандинг ETH 30д < ${x}%`, (d) => C.efund30[d] < x);
for (const x of [-0.5, 0, 0.2]) test(`фандинг BTC 30д < ${x}% (уже есть ряд)`, (d) => IN.fund30[d] < x);
for (const x of [-20, -25, -30, -35]) test(`вынос OI ETH (к макс. 30д) < ${x}%`, (d) => C.eoidd30[d] < x, { show: x === -30 });
for (const x of [-0.02, -0.04, -0.06, -0.08]) test(`базис BTC 7д < ${x}%`, (d) => C.prem7b[d] < x, { show: x === -0.06 });
for (const x of [-0.04, -0.06, -0.08]) test(`базис ETH 7д < ${x}%`, (d) => C.prem7e[d] < x);
for (const x of [0.98, 0.95, 0.92]) test(`хешрейт: ленты 30/60 < ${x} (капитуляция майнеров)`, (d) => C.hrib[d] < x);
for (const k of [1, 7, 14]) test(`хешрейт: ленты снова вверх ${k}-й день`, (d) => C.hribup[d] === k && C.hribup[d - k] === 0, { gap: 60, show: k === 1 });
for (const x of [0.7, 0.8, 0.9, 1]) test(`MVRV ETH < ${x}`, (d) => C.mvrve[d] < x, { show: x === 0.8 });
for (const x of [0.9, 1.0, 1.1]) test(`MVRV BTC < ${x} (уже есть ряд)`, (d) => IN.mvrv[d] < x);
for (const x of [0.6, 0.7, 0.8]) test(`комиссии BTC 30д/365д < ${x}`, (d) => C.feesr[d] < x);
for (const x of [0.6, 0.7, 0.8]) test(`выручка майнеров 30д/365д < ${x}`, (d) => C.revr[d] < x);
for (const x of [0.85, 0.9]) test(`активные адреса ETH 30д/365д < ${x}`, (d) => C.adrer[d] < x);
for (const x of [-1, 0]) test(`стейблкоины за 90д < ${x}% (отток)`, (d) => C.stab90[d] < x, { show: x === 0 });
for (const x of [-2, -3, -4]) test(`доллар за 90д < ${x}%`, (d) => C.dxy90[d] < x);
for (const x of [-0.5, -0.75, -1]) test(`доходность 10л за 90д < ${x} п.п.`, (d) => C.y10d90[d] < x);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop1.json', JSON.stringify(out));
