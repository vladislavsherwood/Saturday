/* tune2: шлифовка правил «паника в стейблах» (покупки #4–#9, #12–#14 combo2) поверх combo2-best.json.
   Параметры P (по умолчанию — как в combo2):
     u   — порог USDT.D к своей средней (1,07);      w  — окно средней USDT.D, дней (200; при 200 — исходный ряд usdt);
     o   — доля альтов меньше (25%);                  fs — сильный страх (40); fw — страх (52); ud — доля USDT меньше (7,6%);
     oi  — вынос OI: oidd30 < −oi (8);               us — сильная паника usdt > us (1,2); m — множитель сильной паники (1,5);
     a1/a2/a3 — доля покупки (% резерва) с выносом OI: сильный страх / страх / без страха (25/50/50);
     b1/b2/b3 — без выноса OI (10/10/10). Сильная паника = a × m.
   Окно средней ≠ 200: индикатор usdtW пересчитывается из usdtd по общему календарю (объединение всех монет).
   Использование: const T = require('./tune2_sim.js'); const G = T.load(); const R = T.ev(G, T.P0) */
const Z = require('./combo2_sim.js');
const fs = require('fs');
const { c } = Z;
const CB = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const P0 = { u: 1.07, w: 200, o: 25, fs: 40, fw: 52, ud: 7.6, oi: 8, us: 1.2, m: 1.5, a1: 25, a2: 50, a3: 50, b1: 10, b2: 10, b3: 10 };
const MINE = [3, 4, 5, 6, 7, 8, 11, 12, 13];
const r6 = (x) => +x.toFixed(6);
function panic(p) {
  const U = p.w === 200 ? 'usdt' : 'usdt' + p.w, R = [];
  const head = [c(U, '>', p.u), c('othd', '<', p.o)];
  const lvl = [[[c('fng', '<', p.fs), c('usdtd', '<', p.ud)], p.a1, p.b1], [[c('fng', '<', p.fw), c('usdtd', '<', p.ud)], p.a2, p.b2], [[], p.a3, p.b3]];
  for (const [f, a, b] of lvl) {
    const conf = [...head, ...f, c('oidd30', '<', -p.oi)];
    R.push({ act: r6(1 + (a * p.m) / 100), conds: [...conf, c(U, '>', p.us)] });
    R.push({ act: r6(1 + a / 100), conds: conf });
    if (b > 0) R.push({ act: r6(1 + b / 100), conds: [...head, ...f] });
  }
  return R;
}
// правила: 0–2 как в combo2, затем паника (сильный страх, страх), затем #9, #10 как в combo2, затем паника без страха, затем остальное
function build(p = P0) {
  const q = { ...P0, ...p }, R = CB.rules, P = panic(q);
  const k1 = q.b1 > 0 ? 3 : 2, k2 = q.b2 > 0 ? 3 : 2;
  return { base: CB.base, rules: [...R.slice(0, 3), ...P.slice(0, k1 + k2), R[9], R[10], ...P.slice(k1 + k2), ...R.slice(14)] };
}
// usdtW: USDT.D / средняя за W дней по общему календарю
const UMAP = new Map(), DONE = new Set();
function addUsdt(G, w) {
  if (DONE.has(w)) return; DONE.add(w);
  if (!UMAP.size) for (const g in G) for (const X of G[g]) for (let i = 0; i < X.n; i++) { const v = X.ind.usdtd[i]; if (!isNaN(v) && !UMAP.has(X.t[i])) UMAP.set(X.t[i], v); }
  const ts = [...UMAP.keys()].sort((a, b) => a - b), val = new Map();
  let s = 0; const q = [];
  for (const t of ts) { const v = UMAP.get(t); q.push(v); s += v; if (q.length > w) s -= q.shift(); val.set(t, q.length >= w ? v / (s / w) : NaN); }
  for (const g in G) for (const X of G[g]) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const v = val.get(X.t[i]); a[i] = v == null ? NaN : v; } X.ind['usdt' + w] = a; }
}
const load = (list) => Z.load(list);
function ev(G, p = P0, list = ['sel', 'ex', 'rnd']) { const q = { ...P0, ...p }; if (q.w !== 200) addUsdt(G, q.w); return Z.sum(Z.evc(G, build(q), list)); }
// строка сравнения с основой: доход (всё, крупные, альты, мемы), строгая всё/сегменты
const SEG = ['all', 'big', 'alt', 'meme'];
function cmp(R, B) {
  const o = { d: {}, why: {} };
  for (const s of SEG) { o.d[s] = Z.inc(R, s) - Z.inc(B, s); o.why[s] = Z.strict(R, B, s); }
  o.ok = SEG.every((s) => !o.why[s].length) && SEG.slice(1).every((s) => o.d[s] >= -1e-9);
  return o;
}
const f3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
function row(tag, R, B) {
  const k = cmp(R, B), w = SEG.flatMap((s) => k.why[s].map((x) => s + ':' + x));
  return `${String(tag).padEnd(14)} ${R.sel.all.med.toFixed(0).padStart(5)} ${R.ex.all.med.toFixed(0).padStart(5)} ${R.rnd.all.med.toFixed(0).padStart(4)} | доход ${f3(k.d.all)} к ${f3(k.d.big)} а ${f3(k.d.alt)} м ${f3(k.d.meme)} | ${k.ok ? '✔' : '· ' + w.slice(0, 3).join(', ')}`;
}
module.exports = { Z, CB, P0, MINE, panic, build, addUsdt, load, ev, cmp, row, f3, SEG };
