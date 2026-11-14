/* Круг 0 (разбор): помесячно — доля кэша, цена, продажи/покупки резерва по типам для крупной монеты в окне лет. node seg_big_loop0b.js BTC 2017 2019 */
const Z = require('./seg_big_sim.js'); const { K } = Z;
const G = Z.load(['sel']); const S = Z.BASE_S;
const [nm, y0, y1] = [process.argv[2], +process.argv[3], +process.argv[4]];
const X = G.sel.find((x) => x.name === nm); const { fr, qs } = Z.cashPath(X, S);
const tr = K.edge(X, S, 0, 'full', true).tr; const tb = new Map(tr.map((t) => [t.i, t]));
const kind = (q) => { if (q < 0) return ''; const r = S.rules[q], h = (i) => r.conds.some((c) => c.ind === i);
  if (r.act < 0) return h('qt') ? 'Т' : h('oth90') ? 'Ш' : h('up90') ? 'П' : h('fund30') ? 'Ф' : 'С';
  return h('btcr30') ? 'Р' : h('ago_qt') ? 'В' : r.act > 1 ? 'Д' : ''; };
let cur = '', line = '';
for (let i = 0; i < X.n; i++) {
  const d = Z.ymd(X.t[i]); const y = +d.slice(0, 4); if (y < y0 || y > y1) continue;
  const m = d.slice(0, 7); if (m !== cur) { if (line) console.log(line); cur = m; line = `${m} p=${X.c[i].toPrecision(4)} кэш ${(100 * fr[i]).toFixed(0)}% fng ${X.ind.fng[i].toFixed(0)} btcath ${X.ind.btcath[i].toFixed(0)} | `; }
  const k = kind(qs[i]); if (k && tb.has(i)) line += k;
}
console.log(line);
