/* imp6, круг 5: насколько округление цены Yahoo до 1e-6 искажает по-монетный бэктест (SHIB, PEPE, BONK, FLOKI в экзамене memes6).
   Для каждой монеты две версии с одинаковым пересчётом индикаторов монеты (up90, rel90/rel180, hi90 — как в lab.js): Yahoo (как в стенде)
   и Binance (полная точность, found/imp6_prices.json; до листинга на Binance — Yahoo). Итог к DCA: худший из сдвигов 0/+1, половины, сдвиг −1.
   Отдельно — то же только с даты листинга (без смешения рядов). Запуск: node app/imp6_r5.js */
const fs = require('fs');
const K = require('./combo_sim.js');
const { edge } = require('./agent_sim.js');
const { edgeS } = require('./imp6_edge.js');
const PR = JSON.parse(fs.readFileSync(__dirname + '/found/imp6_prices.json', 'utf8'));
const BEST = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const S = { base: BEST.base, rules: BEST.rules };
const G = K.groups(['ex']); K.prep(G);
const day = (t) => new Date(t * 86400000).toISOString().slice(0, 10);
function recompute(X, c) {
  const n = X.n, I = { ...X.ind }; I.c = c;
  const b = I.btcp;
  for (const w of [90, 180]) { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = i >= w && b[i] > 0 && b[i - w] > 0 ? ((c[i] / c[i - w]) / (b[i] / b[i - w]) - 1) * 100 : NaN; I['rel' + w] = a; }
  { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (c[j] < m) m = c[j]; a[i] = (c[i] / m - 1) * 100; } I.up90 = a; }
  { const a = new Float64Array(n); for (let i = 0; i < n; i++) { let r = 0; for (let j = Math.max(0, i - 6); j <= i && !r; j++) { let top = j >= 60; for (let q = Math.max(0, j - 89); q < j && top; q++) if (c[q] > c[j]) top = false; if (top) r = 1; } a[i] = r; } I.hi90 = a; }
  return { ...X, c, ind: I };
}
const rows = [];
for (const X of G.ex) {
  const P = PR[X.name]; if (!P) continue;
  const cb = new Float64Array(X.n); let first = -1;
  for (let i = 0; i < X.n; i++) { const v = P[day(X.t[i])]; cb[i] = v ? v[0] : X.c[i]; if (v && first < 0) first = i; }
  const Y = recompute(X, Float64Array.from(X.c)), B = recompute(X, cb);
  const st = (Z) => {
    const e = (l, p) => edge(Z, S, l, p).e;
    return { full: Math.min(e(0, 'full'), e(1, 'full')), h1: Math.min(e(0, 'h1'), e(1, 'h1')), h2: Math.min(e(0, 'h2'), e(1, 'h2')), m1: e(-1, 'full'), l0: e(0, 'full'), l1: e(1, 'full') };
  };
  // только с даты листинга: обрезанные копии
  const cut = (Z) => { const o = { ...Z, n: Z.n - first, ind: {} }; for (const k in Z.ind) o.ind[k] = Z.ind[k].subarray(first); o.c = o.ind.c; o.t = Z.t.subarray(first); o.l = Z.l && Z.l.subarray(first); o.h = Z.h && Z.h.subarray(first); return o; };
  const sy = st(Y), sb = st(B), cy = st(cut(Y)), cbb = st(cut(B));
  const uniq = (a) => new Set(Array.from(a)).size;
  const cnt = (a) => Array.from(a).reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0);
  // сколько дней решение (номер правила) отличается
  const dec = (Z) => { const R = S.rules.map((r) => r.conds.map((cd) => [Z.ind[cd.ind], cd.op === '<', cd.v])); const o = []; for (let j = 0; j < Z.n; j++) { let q = -1; for (let k = 0; k < R.length && q < 0; k++) { if (R[k].every(([a, lt, v]) => (lt ? a[j] < v : a[j] > v))) q = k; } o.push(q); } return o; };
  const dy = dec(Y), db = dec(B); let diff = 0; for (let j = first; j < X.n; j++) if (dy[j] !== db[j]) diff++;
  const r = { coin: X.name, listing: day(X.t[first]), days: X.n - first, uniqY: uniq(X.c.subarray(first)), uniqB: uniq(cb.subarray(first)), diffDays: diff,
    hi90Y: cnt(Y.ind.hi90.subarray(first)), hi90B: cnt(B.ind.hi90.subarray(first)), Y: sy, B: sb, cutY: cy, cutB: cbb };
  rows.push(r);
  const f = (s) => `${s.full.toFixed(0)}% (h1 ${s.h1.toFixed(0)}, h2 ${s.h2.toFixed(0)}; −1/0/+1: ${s.m1.toFixed(0)}/${s.l0.toFixed(0)}/${s.l1.toFixed(0)})`;
  console.log(`${X.name}: с ${r.listing} (${r.days} дн), уникальных закрытий Yahoo ${r.uniqY} / Binance ${r.uniqB}, дней с другим решением ${diff}, дней hi90 ${r.hi90Y}/${r.hi90B}`);
  console.log(`   вся история: Yahoo ${f(sy)} | Binance ${f(sb)}`);
  console.log(`   с листинга:  Yahoo ${f(cy)} | Binance ${f(cbb)}`);
}
fs.writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp6_r5.json', JSON.stringify(rows));
// экзамен целиком (14 монет): Yahoo против Binance для основы и её предшественников — меняется ли вывод «лучше/хуже»
{
  const fix = (X) => { const P = PR[X.name]; if (!P) return X; const cb = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const v = P[day(X.t[i])]; cb[i] = v ? v[0] : X.c[i]; } return recompute(X, cb); };
  const exY = G.ex.map((X) => (PR[X.name] ? recompute(X, Float64Array.from(X.c)) : X)), exB = G.ex.map(fix);
  const C = { 'combo-best': S, 'F (agent4b-best)': K.F, W25: K.W25, 'F + C6': K.withC6(K.F) };
  for (const [tag, SS] of Object.entries(C)) {
    const a = K.evalGroup(exY, SS), b = K.evalGroup(exB, SS);
    console.log(`экзамен ${tag.padEnd(18)} Yahoo: медиана ${a.med.toFixed(0)}%, в плюсе ${a.pos}/14, половин ${a.hpos}/28, худшая половина ${a.hworst.toFixed(0)}% | Binance: ${b.med.toFixed(0)}%, ${b.pos}/14, ${b.hpos}/28, ${b.hworst.toFixed(0)}%`);
  }
}
{
  const C = { combo: S, F: K.F, W25: K.W25 };
  for (const X of G.ex) { const P = PR[X.name]; if (!P) continue;
    const cb = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const v = P[day(X.t[i])]; cb[i] = v ? v[0] : X.c[i]; }
    const Y = recompute(X, Float64Array.from(X.c)), B = recompute(X, cb);
    console.log(X.name + ': ' + Object.entries(C).map(([k, SS]) => `${k} ${K.E(Y, SS, 'full').toFixed(0)}→${K.E(B, SS, 'full').toFixed(0)}%`).join(' | '));
  }
}
