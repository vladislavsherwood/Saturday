/* r4, круг 8: «отложенная эйфория» — зеркало отложенной паники по самому usdt (новый поворот: wild, круг 1, ждал разворота ЦЕНЫ монеты; здесь — разворот usdt от 10-дн. минимума).
   Гипотеза: продавать не пока стейблы тратятся (usdt падает), а когда деньги начали возвращаться в стейблы (usdt вырос от 10-дн. минимума на r) — ближе к вершине.
   dn10 = usdt / min(usdt за 10 дн). V1 — правило эйфории только при dn10 > r; V2 — правило 5% как есть + добавка s2 при dn10 > r; V3 — с состоянием: пока usdt у минимума
   (dn10 ≤ t), долю копим; при dn10 > rv продаём накопленное × m; если эйфория кончилась (usdt > 0,97) — продаём накопленное без надбавки.
   Критерий (заранее): строгая ✔ везде, доход > 0, плато; и «до 2026-08» (без неподтверждённого конца выборки) — не хуже combo4. Запуск: node r4_r8.js */
const L = require('./r4_lib.js'), { S0, c, P } = L, R4 = require('./r4_sim.js');
L.addInd('dn10', (X) => { const u = X.ind.usdt, n = X.n, a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] < m) m = u[k]; a[i] = u[i] / m; } return a; });
const noE = () => { const S = L.clone(); S.rules.pop(); return S; };
const E = (s, extra = [], u = 0.9) => ({ act: -s, conds: [c('usdt', '<', u), c('age', '>', 540), c('meme', '<', 0.5), c('beta180', '>', 0.9), ...extra] });
console.log('— V1: эйфория только на развороте usdt вверх (dn10 > r) —');
for (const r of [1.01, 1.02, 1.035, 1.05]) for (const s of [0.05, 0.1, 0.2]) { const S = noE(); S.rules.push(E(s, [c('dn10', '>', r)])); L.run(`V1 dn10 > ${r} → ${s * 100}%`, S); }
console.log('— V1б: то же, зона шире (usdt < 0,95) —');
for (const r of [1.02, 1.035]) for (const s of [0.05, 0.1]) { const S = noE(); S.rules.push(E(s, [c('dn10', '>', r)], 0.95)); L.run(`V1б usdt<0,95 dn10 > ${r} → ${s * 100}%`, S); }
console.log('— V2: 5% как есть + на развороте доля s2 —');
for (const r of [1.02, 1.035, 1.05]) for (const s of [0.1, 0.15, 0.25]) { const S = noE(); S.rules.push(E(s, [c('dn10', '>', r)]), E(0.05)); L.run(`V2 dn10 > ${r} → ${s * 100}%`, S); }
console.log('— V3: с состоянием (копить у минимума usdt, продать × m на развороте) —');
const isE = (r) => r && r.act < 0 && r.conds.some((x) => x.ind === 'usdt');
const Defer = (t, rv, m) => ({ act: ({ X, j, r, a, mem }) => {
  const I = X.ind, d = I.dn10[j], e = isE(r); let owe = mem.owe || 0;
  if (e && d <= t) { mem.owe = 1 - (1 - owe) * (1 + a); return 1; } // a < 0: копим долю
  if (owe > 0 && (e || (!r && a === 1))) { if (d > rv) { mem.owe = 0; return -Math.min(1, owe * m + (e ? -a : 0)); } if (I.usdt[j] > 0.97) { mem.owe = 0; return -Math.min(1, owe); } }
  return a; } });
for (const [t, rv] of [[1.0, 1.02], [1.01, 1.035], [1.02, 1.035], [1.02, 1.05]]) for (const m of [1, 2]) R4.run(`V3 t ${t} rv ${rv} m ${m}`, S0, L.pol0, Defer(t, rv, m));
