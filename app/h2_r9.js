/* h2, круг 9: соседи кандидата «удержание после капитуляции» (страх < 15 был ≤ 60 дней назад, BTC ниже ATH > 65 → взнос, перед продажами на страхе),
   проверка на основе combo4 без фитилей, сочетание с покупкой крупных в зоне (gap_r4) и с поэтапной покупкой.
   Запуск: node h2_r9.js [wick|plain] [часть: nb|combo] */
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', part = process.argv[3] || 'nb', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r), h = H.halves(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d} | пол ${L.sg(h.h1)}/${L.sg(h.h2)}${r.w ? ' | ' + r.w.slice(0, 100) : ''}`; };
const go = (nm, rules) => { const r = H.run(nm, H.ins(rules, 10), pol, { n100: true, quiet: true }); console.log(ext(r)); return r; };
// fng < q был не позже N дней назад: индикатор h2fdq строится на лету
for (const q of [12, 13, 17, 18]) { const k = 'h2fd' + q; for (const g in H.G) for (const X of H.G[g]) { const I = X.ind, a = new Float64Array(X.n); let last = -1e9; for (let i = 0; i < X.n; i++) { if (I.fng[i] < q) last = i; a[i] = i - last; } I[k] = a; } }
const HOLD = (q = 15, N = 60, X = 65, extra = []) => ({ act: 1, conds: [c(q === 10 ? 'h2fd' : 'h2fd' + q, '<', N), c('btcath', '>', X), ...extra, c('btcr30', '<', 20)] });
if (part === 'nb') {
  go('КАНДИДАТ страх<15 ≤60, ath>65', [HOLD()]);
  for (const q of [12, 13, 17, 18]) go(`страх<${q} ≤60, ath>65`, [HOLD(q)]);
  for (const N of [40, 45, 50, 75, 80]) go(`страх<15 ≤${N}, ath>65`, [HOLD(15, N)]);
  for (const X of [62, 63, 67, 68, 70]) go(`страх<15 ≤60, ath>${X}`, [HOLD(15, 60, X)]);
  for (const [nm, ex] of [['+ mvrv<1,2', [c('mvrv', '<', 1.2)]], ['+ age>90', [c('age', '>', 90)]], ['+ usdt>1', [c('usdt', '>', 1)]]]) go(`страх<15 ≤60, ath>65 ${nm}`, [HOLD(15, 60, 65, ex)]);
  go('страх<15 ≤60, ath>65 → копить', [{ ...HOLD(), act: 1e-6 }]);
}
if (part === 'combo') {
  const BIG = (f, X = 65, q = 25) => ({ act: 1 + f, conds: [c('isbig', '>', 0.5), c('btcath', '>', X), c('fng', '<', q), c('btcr30', '<', 20)] });
  go('крупные: ath>65, страх<25 → +10% (gap_r4, на месте 10)', [BIG(0.1)]);
  go('крупные: ath>65, страх<25 → +25%', [BIG(0.25)]);
  go('удержание + крупные +10%', [BIG(0.1), HOLD()]);
  go('удержание + крупные +25%', [BIG(0.25), HOLD()]);
  go('удержание → +2% (поэтапная покупка в удержании)', [{ ...HOLD(), act: 1.02 }]);
  go('удержание → +5%', [{ ...HOLD(), act: 1.05 }]);
  go('удержание, крупные → +5%, прочие взнос', [{ ...HOLD(15, 60, 65, [c('isbig', '>', 0.5)]), act: 1.05 }, HOLD()]);
}
