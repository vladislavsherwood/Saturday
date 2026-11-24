/* op, круг 1 — диагностика опционных признаков без правил.
   А) Избыток форвардного лог-роста монеты за 30/90 дней после дня режима к среднему той же монеты за дни, где признак определён
      (среднее по монетам с ≥ 10 днями режима; 181 монета) + BTC. Варианты: без 2020-03, без 2022, без 2024-08, без 2025-04, без 2025-10, половины
      (длинные ряды: до/после 2021-07-01; DVOL: 2021-03…2023-12 / 2024-01…). Эпизоды — отрезки режима на календаре BTC (разрыв > 10 дн).
   Б) Где combo6 ошибается: сделки combo6 (сдвиг 0) по семьям правил — средний избыточный лог-рост монеты за 90 дн после сделки по опционным режимам.
      Для продажи плюс = продали перед ростом (плохо), для покупки плюс = хорошо.
   Запуск: node op_r1.js  (лог scratchpad/op/r1.txt) */
const O = require('./op_lib.js'), { T, BY, P, S6, polW, FAM } = O;
O.tee('r1');
const XS = O.XS;
const EP = { '2020-03': [T('2020-02-15'), T('2020-06-15')], '2022': [T('2022-01-01'), T('2023-01-01')], '2024-08': [T('2024-07-15'), T('2024-10-15')], '2025-04': [T('2025-03-01'), T('2025-06-15')], '2025-10': [T('2025-09-15'), T('2026-01-15')] };
const H2 = [30, 90];
function stat(f, def, keep = () => true, xs = XS) {
  const acc = H2.map(() => []); let days = 0, nc = 0;
  for (const X of xs) { const I = X.ind, c = X.c, n = X.n; let dd = 0;
    H2.forEach((h, q) => { let s = 0, m = 0, sa = 0, ma = 0; for (let j = 120; j + h < n; j++) { const t = I.t[j]; if (!keep(t) || !def(I, j)) continue; const r = Math.log(c[j + h] / c[j]); if (!isFinite(r)) continue; sa += r; ma++; if (f(I, j)) { s += r; m++; } }
      if (m >= 10 && ma > 0) acc[q].push(s / m - sa / ma); if (q === 1) dd = m; });
    if (dd >= 10) { days += dd; nc++; } }
  const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length * 100 : NaN);
  return { e30: mean(acc[0]), e90: mean(acc[1]), pos: acc[1].filter((x) => x > 0).length, n: acc[1].length, dpc: nc ? days / nc : 0 };
}
function episodes(f) { const X = BY.BTC, I = X.ind; let cnt = 0, last = -1e9, days = 0; for (let j = 0; j < X.n; j++) if (f(I, j)) { if (j - last > 10) cnt++; last = j; days++; } return { cnt, days }; }
const f1 = (x) => (isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : '—');
const REG = [];
const fin = (k) => (I, j) => isFinite(I[k][j]);
const add = (nm, f, k, dv = false) => REG.push([nm, f, Array.isArray(k) ? (I, j) => k.every((q) => isFinite(I[q][j])) : fin(k), dv]);
const gt = (k, v) => (I, j) => I[k][j] > v, lt = (k, v) => (I, j) => I[k][j] < v;
// VIX-семейство (для сравнения — st B)
add('VIX/SMA50 > 1,5 (st B)', gt('op_vixr', 1.5), 'op_vixr');
add('VIX > 30', gt('op_vix', 30), 'op_vix'); add('VIX < 13 (самоуспокоение)', lt('op_vix', 13), 'op_vix');
add('VIX перцентиль 250 > 0,95', gt('op_vixp', 0.95), 'op_vixp'); add('VIX перцентиль 250 < 0,05', lt('op_vixp', 0.05), 'op_vixp');
add('VIX9D/VIX3M > 1 (инверсия)', gt('op_ts', 1), 'op_ts'); add('VIX9D/VIX3M > 1,1', gt('op_ts', 1.1), 'op_ts'); add('VIX9D/VIX3M > 1,25', gt('op_ts', 1.25), 'op_ts');
add('VIX/VIX3M > 1', gt('op_ts1', 1), 'op_ts1'); add('VIX9D/VIX3M < 0,8 (спокойно)', lt('op_ts', 0.8), 'op_ts'); add('VIX3M/VIX6M > 1', gt('op_ts6', 1), 'op_ts6');
add('инверсия, но VIX/SMA50 < 1,5', (I, j) => I.op_ts[j] > 1 && I.op_vixr[j] < 1.5, ['op_ts', 'op_vixr']);
add('VVIX > 120', gt('op_vvix', 120), 'op_vvix'); add('VVIX > 140', gt('op_vvix', 140), 'op_vvix'); add('VVIX/SMA50 > 1,3', gt('op_vvixr', 1.3), 'op_vvixr'); add('VVIX < 85', lt('op_vvix', 85), 'op_vvix');
add('SKEW > 145', gt('op_skew', 145), 'op_skew'); add('SKEW > 150', gt('op_skew', 150), 'op_skew'); add('SKEW < 120', lt('op_skew', 120), 'op_skew');
add('SKEW − ср.250 > +10', gt('op_skewz', 10), 'op_skewz'); add('SKEW − ср.250 < −10', lt('op_skewz', -10), 'op_skewz');
add('SKEW > 145 и BTC +20% за 30д', (I, j) => I.op_skew[j] > 145 && I.btcr30[j] > 20, 'op_skew');
add('VIX/реализ. S&P < 0,9 (страх реализован)', lt('op_vrp', 0.9), 'op_vrp'); add('VIX/реализ. S&P > 2 (премия)', gt('op_vrp', 2), 'op_vrp');
add('put/call акции 10д > 0,8', gt('op_pce10', 0.8), 'op_pce10'); add('put/call акции 10д < 0,5', lt('op_pce10', 0.5), 'op_pce10');
add('put/call акции z > 2', gt('op_pcez', 2), 'op_pcez'); add('put/call акции z < −1,5', lt('op_pcez', -1.5), 'op_pcez'); add('put/call total 10д > 1,1', gt('op_pct10', 1.1), 'op_pct10');
add('put/call день > 1,0 (equity)', gt('op_pce', 1.0), 'op_pce');
add('GVZ > 25', gt('op_gvz', 25), 'op_gvz'); add('GVZ/SMA50 > 1,4', gt('op_gvzr', 1.4), 'op_gvzr'); add('OVX > 50', gt('op_ovx', 50), 'op_ovx'); add('OVX/SMA50 > 1,5', gt('op_ovxr', 1.5), 'op_ovxr');
add('MOVE > 130', gt('op_move', 130), 'op_move'); add('MOVE/SMA50 > 1,3', gt('op_mover', 1.3), 'op_mover'); add('MOVE < 70', lt('op_move', 70), 'op_move');
// реализованная вол BTC (длинная история) — замена DVOL до 2021
add('реализ. вол BTC 30д / ср.90 > 1,5', gt('op_rvr', 1.5), 'op_rvr'); add('реализ. вол BTC 30д / ср.90 < 0,6', lt('op_rvr', 0.6), 'op_rvr');
add('реализ. вол BTC 30д < 35%', lt('op_rv30', 35), 'op_rv30'); add('реализ. вол BTC 30д > 100%', gt('op_rv30', 100), 'op_rv30');
// DVOL (с 2021-03)
add('DVOL > 90', gt('op_dv', 90), 'op_dv', true); add('DVOL > 75', gt('op_dv', 75), 'op_dv', true); add('DVOL < 45', lt('op_dv', 45), 'op_dv', true); add('DVOL < 40', lt('op_dv', 40), 'op_dv', true);
add('DVOL/SMA50 > 1,3', gt('op_dvr', 1.3), 'op_dvr', true); add('DVOL/SMA50 > 1,5', gt('op_dvr', 1.5), 'op_dvr', true); add('DVOL/SMA50 < 0,8', lt('op_dvr', 0.8), 'op_dvr', true);
add('DVOL за 7 дн ×1,25', gt('op_dvr7', 1.25), 'op_dvr7', true);
add('DVOL перцентиль 365 > 0,9', gt('op_dvp', 0.9), 'op_dvp', true); add('DVOL перцентиль 365 < 0,1', lt('op_dvp', 0.1), 'op_dvp', true);
add('DVOL / реализ. > 1,4 (дорогая страховка)', gt('op_dvrv', 1.4), 'op_dvrv', true); add('DVOL / реализ. < 0,9 (реализ. > подраз.)', lt('op_dvrv', 0.9), 'op_dvrv', true);
add('DVOL на мин. 90 дн', gt('op_dvlo', 0.5), 'op_dvlo', true); add('DVOL < 1,1 × мин. года', lt('op_dvmin', 1.1), 'op_dvmin', true);
add('DVOL ETH / DVOL BTC > 1,4', (I, j) => I.op_dve[j] / I.op_dv[j] > 1.4, 'op_dv', true);
add('низкая DVOL (<45) и страх > 70', (I, j) => I.op_dv[j] < 45 && I.fng[j] > 70, 'op_dv', true);
add('DVOL перц. < 0,2 и BTC +20% за 30д', (I, j) => I.op_dvp[j] < 0.2 && I.btcr30[j] > 20, 'op_dvp', true);
add('DVOL/SMA50 > 1,3 и страх < 20', (I, j) => I.op_dvr[j] > 1.3 && I.fng[j] < 20, 'op_dvr', true);
add('DVOL/SMA50 > 1,3 и страх > 50', (I, j) => I.op_dvr[j] > 1.3 && I.fng[j] > 50, 'op_dvr', true);

const HALF = (dv) => (dv ? [(t) => t < T('2024-01-01'), (t) => t >= T('2024-01-01')] : [(t) => t < T('2021-07-01'), (t) => t >= T('2021-07-01')]);
console.log('А) избыток лог-роста, % (режим минус дни монеты с определённым признаком); 90д — без эпизодов и половины; BTC — только BTC');
console.log(`${'режим'.padEnd(42)} эпиз  дн/мон | 30д    90д (выше/мон) | без: 20-03  2022  24-08  25-04  25-10 | пол1  пол2 | BTC 30д  90д | вывод`);
const out = [];
for (const [nm, f, def, dv] of REG) {
  const a = stat(f, def), ep = episodes(f), ex = Object.values(EP).map(([s, e]) => stat(f, def, (t) => !(t >= s && t < e)).e90), hh = HALF(dv).map((k) => stat(f, def, k)), b = stat(f, def, () => true, [BY.BTC]);
  const all = [a.e90, ...ex, ...hh.map((x) => x.e90), b.e90].filter(isFinite), sgn = Math.sign(a.e90);
  const sig = all.length >= 8 && all.every((x) => Math.sign(x) === sgn) && Math.abs(a.e90) >= 3 ? (sgn > 0 ? 'СИГНАЛ +' : 'СИГНАЛ −') : '';
  out.push({ nm, a, ep, ex, hh: hh.map((x) => [x.e30, x.e90]), b, sig });
  console.log(`${nm.padEnd(42)} ${String(ep.cnt).padStart(4)} ${String(Math.round(a.dpc)).padStart(6)} | ${f1(a.e30).padStart(5)} ${f1(a.e90).padStart(6)} (${a.pos}/${a.n}) | ${ex.map((x) => f1(x).padStart(6)).join('')} | ${hh.map((x) => f1(x.e90).padStart(5)).join(' ')} | ${f1(b.e30).padStart(6)} ${f1(b.e90).padStart(6)} | ${sig}`);
}
// Б) сделки combo6 по семьям и опционным режимам
console.log('\nБ) сделки combo6 (сдвиг 0, 181 монета): средний избыточный лог-рост монеты за 90 дн после сделки, % (число сделок); для продаж плюс = плохо');
const SPL = [['VIX/50>1,5', (I, j) => I.op_vixr[j] > 1.5], ['инверсия', (I, j) => I.op_ts[j] > 1], ['VVIX>120', (I, j) => I.op_vvix[j] > 120], ['SKEW>145', (I, j) => I.op_skew[j] > 145],
  ['SKEW<125', (I, j) => I.op_skew[j] < 125], ['pc10>0,75', (I, j) => I.op_pce10[j] > 0.75], ['pc10<0,55', (I, j) => I.op_pce10[j] < 0.55], ['VIX<14', (I, j) => I.op_vix[j] < 14],
  ['DVOL>75', (I, j) => I.op_dv[j] > 75], ['DVOL<45', (I, j) => I.op_dv[j] < 45], ['DVr>1,3', (I, j) => I.op_dvr[j] > 1.3], ['DV/RV>1,3', (I, j) => I.op_dvrv[j] > 1.3], ['DV/RV<1', (I, j) => I.op_dvrv[j] < 1],
  ['rvr>1,5', (I, j) => I.op_rvr[j] > 1.5], ['GVZ>22', (I, j) => I.op_gvz[j] > 22]];
const acc = {}; const put = (k, s, v) => { const o = (acc[k] = acc[k] || {}); const z = (o[s] = o[s] || { n: 0, s: 0 }); z.n++; z.s += v; };
for (const X of XS) {
  const I = X.ind, c = X.c, n = X.n; let sa = 0, ma = 0; for (let j = 120; j + 90 < n; j++) { const r = Math.log(c[j + 90] / c[j]); if (isFinite(r)) { sa += r; ma++; } } const base = ma ? sa / ma : 0;
  const { tr } = P.edge(X, S6, 0, 'full', true, polW);
  for (const t of tr) { if (t.i + 90 >= n) continue; const j = t.i - 1, fam = t.q >= 0 ? FAM(t.q) : 'wick', v = (Math.log(c[t.i + 90] / c[t.i]) - base) * 100; if (!isFinite(v)) continue;
    const k = fam + (t.s > 0 ? ' куп' : ' прод'); put(k, 'все', v); for (const [s, f] of SPL) if (f(I, j)) put(k, s, v); }
}
const cols = ['все', ...SPL.map((x) => x[0])];
console.log(`${'семья'.padEnd(11)}${cols.map((s) => s.padStart(13)).join('')}`);
for (const k of Object.keys(acc).sort()) console.log(`${k.padEnd(11)}${cols.map((s) => { const z = acc[k][s]; return (z && z.n >= 5 ? `${f1(z.s / z.n)}(${z.n})` : '—').padStart(13); }).join('')}`);
require('fs').writeFileSync(O.LOG + 'r1.json', JSON.stringify({ out, acc }));
