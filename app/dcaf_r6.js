/* dcaf, круг 3: «ловушка для фитилей» — проверки. Запуск: node dcaf_r6.js */
const L = require('./r4_lib.js'), { S0, P, G } = L;
const LV = [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]];
const W = (o = {}) => ({ ...L.pol0, wick: { lv: LV, age: 60, ...o } });
const out = (r) => console.log(r.txt.slice(0, 190));
// доля монет (всех списков) с минимумом дня ≤ −25% от вчерашнего закрытия — «обвал рынка» (только для разбора, не правило)
const cnt = {}, tot = {};
for (const g in G) for (const X of G[g]) for (let i = 61; i < X.n; i++) { const t = X.ind.t[i]; tot[t] = (tot[t] || 0) + 1; if (X.l[i] <= X.c[i - 1] * 0.75) cnt[t] = (cnt[t] || 0) + 1; }
const wide = (X, i) => (cnt[X.ind.t[i]] || 0) / tot[X.ind.t[i]] >= 0.15;
L.run('combo4', S0);
out(L.run('фитили −25/40/60: 10/20/30%', S0, W(), { quiet: true }));
out(L.run('  контроль: по закрытию дня (без фитиля)', S0, W({ mode: 'close' }), { quiet: true }));
out(L.run('  только дни обвала рынка (≥15% монет)', S0, W({ day: wide }), { quiet: true }));
out(L.run('  только одиночные фитили', S0, W({ day: (X, i) => !wide(X, i) }), { quiet: true }));
out(L.run('  пробой лимита на 3%', S0, W({ tt: 0.03 }), { quiet: true }));
out(L.run('  пробой лимита на 5%', S0, W({ tt: 0.05 }), { quiet: true }));
out(L.run('  заявки обновлять раз в неделю', S0, W({ every: 7 }), { quiet: true }));
out(L.run('  возраст монеты > 365 дн', S0, W({ age: 365 }), { quiet: true }));
for (const [nm, lv] of [['−30/50/70: 10/20/30', [[0.3, 0.1], [0.5, 0.2], [0.7, 0.3]]], ['−20/35/50: 10/20/30', [[0.2, 0.1], [0.35, 0.2], [0.5, 0.3]]], ['−25/40/60: 5/10/15', [[0.25, 0.05], [0.4, 0.1], [0.6, 0.15]]], ['−25/40/60: 20/30/50', [[0.25, 0.2], [0.4, 0.3], [0.6, 0.5]]]])
  out(L.run('соседи ' + nm, S0, { ...L.pol0, wick: { lv, age: 60 } }, { quiet: true }));
const r = L.run('финал 100 новых', S0, W(), { quiet: true, n100: true }); console.log(r.txt.slice(0, 120), '|', (r.txt.match(/100н.*/) || [''])[0]);
