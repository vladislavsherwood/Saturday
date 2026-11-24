/* au, круг 2: (а) сигналы металлов внутри одинакового состояния крипты (клетка: решение combo6 покупка/продажа/взнос × BTC выше/ниже 200д);
   (б) проверка круговым сдвигом ряда металла (300 сдвигов 180…N−180 дней); (в) крипта → золото/серебро 90 дней, тоже со сдвигами.
   Запуск: node au_r2.js > scratchpad/au/r2.txt */
const A = require('./au_lib.js'), { CAL, T0, XS, BY, S6, day, T } = A;
const N = CAL.auc.length;
// решение combo6 по дню: 1 — покупка из резерва (act > 1), −1 — продажа, 0 — обычный взнос
const R6 = S6.rules;
function cls(X) { const R = R6.filter((r) => r.conds.every((cd) => X.ind[cd.ind])); const a = new Int8Array(X.n); for (let j = 0; j < X.n; j++) { for (const r of R) if (r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; })) { a[j] = r.act > 1.0001 ? 1 : r.act < 0 ? -1 : 0; break; } } return a; }
const CL = new Map(XS.map((X) => [X, cls(X)]));
const H = [30, 90];
// событие — функция календарного индекса k (только металлы)
const EVS = {
  'золото −5% за месяц': (k) => CAL.au_r30[k] < -5,
  'золото −3% за неделю': (k) => CAL.au_r7[k] < -3,
  'серебро −10% за месяц': (k) => CAL.ag_r30[k] < -10,
  'серебро хуже золота на 8% за 30 д': (k) => CAL.ag_r30[k] - CAL.au_r30[k] < -8,
  'серебро +15% за месяц': (k) => CAL.ag_r30[k] > 15,
  'серебро лучше золота на 8% за 30 д': (k) => CAL.ag_r30[k] - CAL.au_r30[k] > 8,
  'золото на 250-дн. максимуме': (k) => CAL.au_hi250[k] > 0.5,
  'золото у рекорда (≤5 дн.)': (k) => CAL.au_hid[k] <= 5,
  'золото +6% за месяц': (k) => CAL.au_r30[k] > 6,
};
// предрасчёт: форвардные лог-доходности и клетки по монетам
const PRE = XS.map((X) => { const I = X.ind, cl = CL.get(X); const f = H.map((h) => Float64Array.from({ length: X.n }, (_, j) => (j >= 60 && j + h < X.n ? Math.log(X.c[j + h] / X.c[j]) : NaN)));
  const cell = Int8Array.from({ length: X.n }, (_, j) => (cl[j] + 1) * 2 + (I.btc200[j] >= 1 ? 1 : 0));
  const mAll = f.map((r) => { let s = 0, m = 0; for (const v of r) if (isFinite(v)) { s += v; m++; } return s / m; });
  const mCell = f.map((r) => { const s = new Float64Array(6), m = new Float64Array(6); r.forEach((v, j) => { if (isFinite(v)) { s[cell[j]] += v; m[cell[j]]++; } }); return Array.from(s, (x, q) => (m[q] ? x / m[q] : NaN)); });
  const k = Int32Array.from(I.t, (t) => t - T0); return { X, f, cell, mAll, mCell, k }; });
const KLO = Math.min(...PRE.map((p) => p.k[0])), KHI = Math.max(...PRE.map((p) => p.k[p.k.length - 1]));
// избыток (среднее по монетам) при сдвиге ряда металла на sh дней (циклически внутри [KLO, KHI])
function exc(ev, sh = 0, mode = 'all') {
  const L = KHI - KLO + 1, E = new Uint8Array(L); for (let q = 0; q < L; q++) { const k0 = KLO + ((q - sh) % L + L) % L; E[q] = ev(k0) ? 1 : 0; }
  return H.map((h, hi) => { let t = 0, nn = 0; for (const p of PRE) { let s = 0, m = 0; const r = p.f[hi]; for (let j = 0; j < p.X.n; j++) { const v = r[j]; if (!isFinite(v) || !E[p.k[j] - KLO]) continue; const b = mode === 'all' ? p.mAll[hi] : p.mCell[hi][p.cell[j]]; if (!isFinite(b)) continue; s += v - b; m++; } if (m >= 5) { t += s / m; nn++; } } return nn ? t / nn : NaN; });
}
// по клеткам: избыток внутри каждой клетки (среднее по монетам)
function byCell(ev) { const out = []; for (let c = 0; c < 6; c++) { const v = H.map((h, hi) => { let t = 0, nn = 0, dd = 0; for (const p of PRE) { let s = 0, m = 0; const r = p.f[hi]; for (let j = 0; j < p.X.n; j++) { if (p.cell[j] !== c) continue; const v2 = r[j]; if (!isFinite(v2) || !ev(p.k[j])) continue; s += v2 - p.mCell[hi][c]; m++; } if (m >= 5) { t += s / m; nn++; dd += m; } } return [nn ? t / nn : NaN, dd]; }); out.push(v); } return out; }
const CN = ['покупка, BTC<200д', 'покупка, BTC>200д', 'взнос, BTC<200д', 'взнос, BTC>200д', 'продажа, BTC<200д', 'продажа, BTC>200д'];
const pc = (v) => (isFinite(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%' : '—');
const SH = []; { let s = 12345; const L = KHI - KLO + 1; for (let q = 0; q < 300; q++) { s = (s * 1103515245 + 12345) % 2147483648; SH.push(180 + (s % (L - 360))); } }
console.log(`Календарь крипты ${day(T0 + KLO)} … ${day(T0 + KHI)}; сдвигов ${SH.length}`);
console.log('событие'.padEnd(36), 'избыток 30/90 (к обычному) | к своей клетке 30/90 | p сдвига 30/90 (тот же знак, не меньше)');
for (const [nm, ev] of Object.entries(EVS)) {
  const a = exc(ev, 0, 'all'), b = exc(ev, 0, 'cell');
  const sh = SH.map((s) => exc(ev, s, 'cell')); const p = H.map((h, hi) => sh.filter((x) => Math.sign(x[hi]) === Math.sign(b[hi]) && Math.abs(x[hi]) >= Math.abs(b[hi])).length / sh.length);
  console.log(`${nm.padEnd(36)} ${pc(a[0])} / ${pc(a[1])} | ${pc(b[0])} / ${pc(b[1])} | p ${p[0].toFixed(2)} / ${p[1].toFixed(2)}`);
  const bc = byCell(ev); console.log(`${''.padEnd(36)} клетки 90 д: ${bc.map((v, c) => `${CN[c]} ${pc(v[1][0])} (${v[1][1]})`).join('; ')}`);
}
// (в) крипта → металл: события по BTC стенда, рост металла за 90 дней сверх обычного; сдвиг ряда событий
console.log('\n=== Крипта → металл: рост металла за 30/90 дней сверх обычного, p кругового сдвига ===');
const BX = BY.BTC, I = BX.ind, bk = Int32Array.from(I.t, (t) => t - T0);
function gx(M, ev, sh, h) { const n = BX.n, E = new Uint8Array(n); for (let j = 0; j < n; j++) { const q = ((j - sh) % n + n) % n; E[j] = ev(I, q) ? 1 : 0; }
  let s = 0, m = 0, sa = 0, ma = 0; for (let j = 200; j < n; j++) { const k = bk[j]; if (k + h >= M.length || !isFinite(M[k + h]) || !isFinite(M[k])) continue; const r = Math.log(M[k + h] / M[k]); sa += r; ma++; if (E[j]) { s += r; m++; } } return m >= 10 ? s / m - sa / ma : NaN; }
const CR = {
  'BTC −25% за 30 дней': (I, j) => I.btcr30[j] < -25,
  'страх < 20': (I, j) => I.fng[j] < 20,
  'BTC ниже 200д (btc200 < 0,85)': (I, j) => I.btc200[j] < 0.85,
  'BTC/золото −30% за 90д': (I, j) => I.bg_r90[j] < -30,
  'BTC +30% за 30 дней': (I, j) => I.btcr30[j] > 30,
  'BTC/золото +40% за 90д': (I, j) => I.bg_r90[j] > 40,
  'эйфория в стейблах (usdt < 0,9)': (I, j) => I.usdt[j] < 0.9,
  'BTC у рекорда (< 5%)': (I, j) => I.btcath[j] < 5,
  'BTC выше 200д на 30%': (I, j) => I.btc200[j] > 1.3,
};
const SHB = []; { let s = 777; for (let q = 0; q < 300; q++) { s = (s * 1103515245 + 12345) % 2147483648; SHB.push(180 + (s % (BX.n - 360))); } }
for (const [lab, M] of [['золото', CAL.auc], ['серебро', CAL.agc]]) for (const [nm, ev] of Object.entries(CR)) {
  const o = [30, 90].map((h) => { const x = gx(M, ev, 0, h), sh = SHB.map((s) => gx(M, ev, s, h)).filter(isFinite); const p = sh.filter((v) => Math.sign(v) === Math.sign(x) && Math.abs(v) >= Math.abs(x)).length / sh.length; return `${h}д ${pc(x)} p ${p.toFixed(2)}`; });
  console.log(`${(lab + ': ' + nm).padEnd(46)} ${o.join(' | ')}`);
}
