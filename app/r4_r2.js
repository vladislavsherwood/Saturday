/* r4, круг 2: обрыв othd < 25 в определении паники — можно ли сгладить / что за ним стоит.
   Гипотеза: порог 25 делает две вещи: (1) отсекает хронические паники 2018 и 2021–22 (othd > 30) — это устойчивый режимный смысл (плато 26–30);
   (2) тонкое разделение 25 против 25–27,5 — подгонка к двум эпизодам (сент.–окт. 2020, март 2025). Если (2) — удача, то правка «только до 2021» и «только после 2021»
   дадут разные знаки, а лесенка (25–27,5 → половина доли) или ранговый порог (othd ниже q своей 4-летней истории) будут не хуже combo4 и устойчивее к сдвигу.
   Критерий (заранее): принять замену, если строгая ✔ и доход ≥ 0; «устойчивая альтернатива» — если доход ≥ −0,1 и худший сдвиг порога ±5% теряет ≤ 0,3 (у combo4 −2,44).
   Запуск: node r4_r2.js */
const L = require('./r4_lib.js'), { S0, c, G } = L;
const D = L.T('2021-01-01');
const map = (fn) => { const S = L.clone(); S.rules = S.rules.flatMap((r) => (L.isPanic(r) ? fn(r) : [r])); return S; };
const oth = (r, v, extra = []) => ({ act: r.act, conds: [...r.conds.map((x) => (x.ind === 'othd' ? { ...x, v } : x)), ...extra] });
// лесенка: копии правил паники с othd < hi и долей × k — после всех правил паники (перед охраной)
const ladder = (hi, k, lo = 25) => { const S = L.clone(S0); const pan = S.rules.filter(L.isPanic), last = S.rules.indexOf(pan[pan.length - 1]); const cp = pan.map((r) => ({ act: 1 + (r.act - 1) * k, conds: r.conds.map((x) => (x.ind === 'othd' ? { ...x, v: hi } : x)) })); S.rules.splice(last + 1, 0, ...cp); if (lo !== 25) for (const r of pan) for (const x of r.conds) if (x.ind === 'othd') x.v = lo; return S; };
console.log('— пороги —');
L.run('combo4');
for (const v of [23.75, 26.25, 27.5, 28.75, 30]) L.run(`othd < ${v}`, L.shift(S0, 'othd', () => v));
console.log('— когда 27,5 хуже 25: по эпохам —');
L.run('27,5 только до 2021', map((r) => [oth(r, 27.5, [c('t', '<', D)]), r]));
L.run('27,5 только с 2021', map((r) => [oth(r, 27.5, [c('t', '>', D - 1)]), r]));
console.log('— лесенка (сглаживание обрыва) —');
for (const [hi, k] of [[27.5, 0.5], [27.5, 0.25], [26.25, 0.5], [30, 0.5]]) L.run(`25 полная; 25–${hi} доля × ${k}`, ladder(hi, k));
L.run('23,75 полная; 23,75–26,25 × 0,5', ladder(26.25, 0.5, 23.75));
console.log('— ранговый порог: доля дней за 4 года (1460) с othd ниже сегодняшнего < q —');
L.addInd('othq', (X) => { const o = X.ind.othd, n = X.n, a = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) { if (!isFinite(o[i])) continue; let k = 0, m = 0; for (let j = Math.max(0, i - 1459); j <= i; j++) if (isFinite(o[j])) { m++; if (o[j] < o[i]) k++; } if (m >= 365) a[i] = k / m; } return a; });
const rank = (q) => { const S = L.clone(S0); for (const r of S.rules) if (L.isPanic(r)) r.conds = r.conds.map((x) => (x.ind === 'othd' ? c('othq', '<', q) : x)); return S; };
// у BTC (общая история рынка) — сверка: сколько дней паники совпадает
{ const X = G.sel.find((x) => x.name === 'BTC'), I = X.ind; for (const q of [0.3, 0.4, 0.5, 0.6]) { let a = 0, b = 0, ab = 0; for (let i = 0; i < X.n; i++) if (I.usdt[i] > 1.07) { const p = I.othd[i] < 25, r = I.othq[i] < q; a += p; b += r; ab += p && r; } console.log(`q ${q}: дней паники othd<25 ${a}, ранг<q ${b}, общих ${ab}`); } }
for (const q of [0.3, 0.35, 0.4, 0.45, 0.5, 0.6]) { L.episodesBy((I, i) => I.usdt[i] > 1.07 && I.othq[i] < q); L.run(`ранг othd < ${q}`, rank(q)); }
L.restoreEp();
