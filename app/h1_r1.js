/* h1, круг 1: доход на резерв (сбережения). Постоянная ставка 3 / 4,5 / 6 / 8% и кривая 3-мес. векселей США по годам (× 0,5 / × 1 / + 1%).
   Отдельно — меняет ли доход решения: те же ручки (доли покупок из резерва, продажи, доли фитилей, «копить взнос», «+2% резерва в быке») с доходом и без —
   сравнение «разница разниц». Запуск: node h1_r1.js */
const H = require('./h1_lib.js'), { c } = H.L;
H.head();
const Y = [['4,5%', H.yFix(4.5)], ['векселя', H.yTB(1)]];
console.log('--- ставка (основа W)');
for (const a of [3, 4.5, 6, 8]) H.ev(`W + ${a}% годовых`, H.mk(H.yFix(a)), { n100: a === 4.5 });
H.ev('W + векселя × 0,5', H.mk(H.yTB(0.5)));
H.ev('W + векселя', H.mk(H.yTB(1)), { n100: true });
H.ev('W + векселя + 1%', H.mk(H.yTB(1, 1)));
console.log('--- на combo4 без фитилей (C)');
H.ev('C + 4,5%', H.mk(H.yFix(4.5), H.polC), { n100: true });
H.ev('C + векселя', H.mk(H.yTB(1), H.polC), { n100: true });
console.log('W + 4,5%:', H.cashShare(H.mk(H.yFix(4.5))));
console.log('--- меняет ли доход решения: ручка без дохода / с 4,5% / с векселями; Δ = (с доходом − его основа) − (без дохода − W)');
const scale = (mb, ms) => { const S = H.L.clone(H.S57); for (const r of S.rules) { if (r.act > 1) r.act = 1 + (r.act - 1) * mb; else if (r.act < 0) r.act *= ms; } return S; };
const add = (rule) => { const S = H.L.clone(H.S57); S.rules.push(rule); return S; };
const knobs = [
  ['покупки из резерва × 0,75', { S: scale(0.75, 1) }],
  ['покупки из резерва × 1,25', { S: scale(1.25, 1) }],
  ['продажи × 0,75', { S: scale(1, 0.75) }],
  ['продажи × 1,25', { S: scale(1, 1.25) }],
  ['фитили: доли × 0,75', { wick: { ...H.WICK, lv: H.WICK.lv.map(([k, f]) => [k, f * 0.75]) } }],
  ['фитили: доли × 1,25', { wick: { ...H.WICK, lv: H.WICK.lv.map(([k, f]) => [k, f * 1.25]) } }],
  ['копить взнос всегда (дни без сигнала)', { S: add({ act: 1e-6, conds: [] }) }],
  ['копить взнос, монета < 200д', { S: add({ act: 1e-6, conds: [c('sma200', '<', 1)] }) }],
  ['+2% резерва в быке (монета и BTC > 200д)', { S: add({ act: 1.02, conds: [c('sma200', '>', 1), c('btc200', '>', 1)] }) }],
];
const base0 = { all: 0 }, by = {};
for (const [yn, yh] of Y) by[yn] = H.ev(`W + ${yn} (основа ручек)`, H.mk(yh), { quiet: true });
for (const [nm, o] of knobs) {
  const pw = { ...H.polW, ...(o.wick ? { wick: o.wick } : {}) }, S = o.S || H.S57;
  const r0 = H.ev(nm, pw, { S, quiet: true });
  const parts = [`${nm.padEnd(44)} без дохода ${H.sg(r0.all)} ${r0.ok ? '✔' : '✗'} 81 ${H.sg(r0.m81)}`];
  for (const [yn, yh] of Y) { const r = H.ev(nm + ' + ' + yn, H.mk(yh, pw), { S, quiet: true }); const d = r.all - by[yn].all, dm = r.m81 - by[yn].m81; parts.push(`${yn}: ${H.sg(d)} 81 ${H.sg(dm)} | Δ ${H.sg(d - r0.all)} (81 ${H.sg(dm - r0.m81)})`); }
  console.log(parts.join(' || '));
}
