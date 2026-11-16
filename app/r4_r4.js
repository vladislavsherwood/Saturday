/* r4, круг 4: лесенка эйфории по глубине.
   Гипотеза: чем сильнее стейблы потрачены (usdt ниже), тем ближе вершина → долю продажи растить с глубиной: usdt < 0,9 → 5% (как сейчас), usdt < u2 → s2 > 5%.
   Диагностика wild: usdt < 0,8 — BTC через 180 дн. в среднем −7%. Критерий (заранее): строгая ✔ везде, доход > 0, плато по u2 и s2 (≥ 2/3 вариантов ✔ и в плюсе).
   Запуск: node r4_r4.js */
const L = require('./r4_lib.js'), { S0, c, G } = L;
// сколько дней и когда: usdt < порога (по BTC)
{ const X = G.sel.find((x) => x.name === 'BTC'), I = X.ind; for (const u of [0.9, 0.85, 0.8, 0.75, 0.7]) { const y = {}; for (let i = 0; i < X.n; i++) if (I.usdt[i] < u) { const k = L.day(X.t[i]).slice(0, 4); y[k] = (y[k] || 0) + 1; } console.log(`usdt < ${u}:`, JSON.stringify(y)); } }
const lad = (u2, s2, u3 = null, s3 = null) => { const S = L.clone(); const e = S.rules.pop(); const mk = (u, s) => ({ act: -s, conds: e.conds.map((x) => (x.ind === 'usdt' ? { ...x, v: u } : x)) }); if (u3) S.rules.push(mk(u3, s3)); S.rules.push(mk(u2, s2), e); return S; };
const res = [];
for (const u2 of [0.87, 0.85, 0.82, 0.8, 0.75]) for (const s2 of [0.03, 0.08, 0.1, 0.15]) { const r = L.run(`usdt < ${u2} → ${s2 * 100}%`, lad(u2, s2)); res.push(r); }
console.log(`✔ ${res.filter((r) => !r.w).length} из ${res.length}; в плюсе ${res.filter((r) => r.d > 0).length}; ✔ и в плюсе ${res.filter((r) => !r.w && r.d > 0).length}`);
L.run('три ступени 0,9→5 / 0,85→8 / 0,8→12', lad(0.85, 0.08, 0.8, 0.12));
module.exports = { lad };
