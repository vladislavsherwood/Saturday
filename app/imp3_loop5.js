/* imp3, круг 5: направление эпизода — продолжается ли падение и разворачивается ли страх. На двух основах: combo-best и combo2-best.
   Гипотеза: (а) пока BTC продолжает падать от начала эпизода (fepb < −15…−30%), продажи на страхе выгоднее — ×1,25/×1,5 (заметка круга 2), с плато
   по окну эпизода g = 7/14/30 и порогу; (б) когда страх уже разворачивается вверх (fng поднялся от минимума за 14 дней на > 8/12/16) — у дна, продавать
   меньше (×0,5); углубление страха (fng ниже максимума за 14 дней на > 15/25) — больше (×1,25). Запуск: node app/imp3_loop5.js <out.json> */
const Z = require('./imp3_sim.js');
const Z2 = require('./combo2_sim.js');
const fs = require('fs');
const { c, K } = Z;
const G = Z2.load();
for (const g of [7, 14, 30]) Z.addEp(G, g);
for (const g in G) for (const X of G[g]) { const f = X.ind.fng, up = new Float64Array(X.n), dn = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let mn = Infinity, mx = -Infinity; for (let j = Math.max(0, i - 13); j <= i; j++) { mn = Math.min(mn, f[j]); mx = Math.max(mx, f[j]); } up[i] = f[i] - mn; dn[i] = mx - f[i]; } X.ind.fngup14 = up; X.ind.fngdn14 = dn; }
const C2 = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const BASES = { 'combo-best': Z.BASE, 'combo2-best': { base: C2.base, rules: C2.rules } };
const out = {};
for (const bn in BASES) {
  const B0 = BASES[bn], base = Z.ev(G, B0), o = (out[bn] = []), run = Z.runner(G, base, o);
  console.log(`\n=== основа ${bn}\n` + Z.row('ОСНОВА', base, base));
  const M = (L) => Z.mod(B0, L);
  for (const g of [7, 14, 30]) for (const x of [-15, -20, -25, -30]) for (const k of [1.25, 1.5]) run(`BTC от начала эпизода (g${g}) < ${x}% → ×${k}`, M([[[c('fepb' + g, '<', x)], k]]));
  for (const x of [8, 12, 16]) run(`страх поднялся от мин. 14 дн > ${x} → ×0.5`, M([[[c('fngup14', '>', x)], 0.5]]));
  for (const x of [15, 25]) run(`страх углубился от макс. 14 дн > ${x} → ×1.25`, M([[[c('fngdn14', '>', x)], 1.25]]));
  run('BTC (g14) < −20% ×1,25 + страх поднялся > 12 ×0,5', M([[[c('fngup14', '>', 12)], 0.5], [[c('fepb14', '<', -20)], 1.25]]));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
