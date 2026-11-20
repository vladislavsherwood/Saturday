/* h3, диагностика 2: «потолок» в официальной метрике. Оракул продаёт долю f позиции на следующий день после каждой вершины из списка (h3_d1.js → d1_wick.json):
   все крупные вершины / только пропущенные (продано < 20% к −40%, доля > 30%) / по типам. Доход — Σ лог-медиан к основе (combo4 + фитили), строгая, 100 новых. */
const H = require('./h3_lib.js'), { L, P, G, c } = H;
const tops = require('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/d1_wick.json');
H.base('wick');
L.addInd('h3o', (X) => new Float64Array(X.n));
const byName = {}; for (const g in G) for (const X of G[g]) byName[g + ':' + X.name] = X;
const set = (sel) => { for (const g in G) for (const X of G[g]) X.ind.h3o.fill(0); let k = 0; for (const t of tops) if (sel(t)) { byName[t.g + ':' + t.nm].ind.h3o[t.i] = 1; k++; } return k; };
const miss = (t) => t.sold40 < 0.2 && t.sh > 0.3;
for (const f of [0.5, 1]) {
  const So = H.cl(); So.rules.unshift({ act: -f, conds: [c('h3o', '>', 0.5)] });
  for (const [nm, sel] of [['все вершины', () => true], ['пропущенные', miss], ['пропущенные R27', (t) => miss(t) && t.typ === 'R27'], ['пропущенные EARLY', (t) => miss(t) && t.typ === 'EARLY'], ['пропущенные без шипов', (t) => miss(t) && !t.spike], ['не пропущенные', (t) => !miss(t)]]) {
    const k = set(sel); L.run(`оракул ${f * 100}%: ${nm} (${k})`, So, H.polW, { n100: true });
  }
}
