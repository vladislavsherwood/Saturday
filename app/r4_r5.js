/* r4, круг 5: «светофор внутри правил» — какие рыночные правила не работают у монет со слабой связью с рынком.
   Гипотеза: эйфория работает только при бете > 0,9; возможно, и другие рыночные правила (продажи на страхе, фандинг, тихая/широкая вершина) вредят монетам
   с бетой < 0,5 — тогда фильтр «бета180 > b» у класса правил даст плюс без потерь у остальных. Сначала диагностика исходов сделок combo4 по классам × бета
   (81 монета; исход продажи = ln(цена через 180 дн / цена продажи), > 0 — продали зря; покупки — наоборот), потом проверка фильтров.
   Критерий (заранее): строгая ✔ везде, доход > 0, плато по порогу беты (0,3 / 0,5 / 0,7). Запуск: node r4_r5.js */
const L = require('./r4_lib.js'), { S0, c, G, P } = L, R4 = require('./r4_sim.js');
const has = (r, ind, op, v) => r.conds.some((x) => x.ind === ind && (op == null || (x.op === op && x.v === v)));
const cls = (r) => { if (!r) return 'взнос'; if (r.act > 1) { if (has(r, 'usdt')) return 'B паника'; if (has(r, 'btcr30')) return 'B разворот'; if (has(r, 'fng')) return has(r, 'hi90') ? 'B возврат' : 'B капитуляция'; return 'B ликвидации'; } if (has(r, 'usdt')) return 'S эйфория'; if (has(r, 'fng', '<', 40)) return 'S страх40'; if (has(r, 'fng', '<', 52)) return 'S страх52'; if (has(r, 'fund30')) return 'S фандинг'; if (has(r, 'qt')) return 'S тихая'; if (has(r, 'up90')) return 'S памп'; if (has(r, 'btcath')) return 'S широкая'; return 'S альтсезон'; };
const H = 180, bk = (b) => (!isFinite(b) ? 'нет' : b < 0.5 ? '<0,5' : b < 0.9 ? '0,5–0,9' : '>0,9');
if (require.main === module) {
  const T = {};
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
    const { tr } = R4.edge(X, S0, 0, 'full', true, L.pol0);
    for (const t of tr) { if (t.i + H >= X.n) continue; const k = cls(t.r) + (t.rel ? '' : ''), b = bk(X.ind.beta180[t.j]); const o = Math.log(X.c[t.i + H] / t.p); const key = k + '|' + b; const q = (T[key] = T[key] || { w: 0, wo: 0, n: 0, coins: new Set() }); q.w += t.amt; q.wo += t.amt * o; q.n++; q.coins.add(X.name); }
  }
  // по монетам поровну: средний исход на монету (взвеш. по деньгам внутри монеты) — чтобы крупные резервы не решали всё
  const TC = {};
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) { const { tr } = R4.edge(X, S0, 0, 'full', true, L.pol0); const m = {}; for (const t of tr) { if (t.i + H >= X.n) continue; const key = cls(t.r) + '|' + bk(X.ind.beta180[t.j]); const q = (m[key] = m[key] || { w: 0, wo: 0 }); q.w += t.amt; q.wo += t.amt * Math.log(X.c[t.i + H] / t.p); } for (const k in m) (TC[k] = TC[k] || []).push(m[k].wo / m[k].w); }
  console.log('класс | бета | сделок | монет | исход по деньгам | средний по монетам | доля монет с «плохим» исходом');
  for (const k of Object.keys(T).sort()) { const q = T[k], a = TC[k], sell = k.startsWith('S'); const bad = a.filter((v) => (sell ? v > 0 : v < 0)).length; console.log(k.padEnd(24), String(q.n).padStart(6), String(q.coins.size).padStart(4), (q.wo / q.w).toFixed(3).padStart(8), (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3).padStart(8), `${bad}/${a.length}`); }
}
module.exports = { cls, has };
