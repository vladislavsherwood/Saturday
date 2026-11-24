/* st, круг 1 — диагностика «крипта против акций» без правил.
   А) Есть ли прогноз сам по себе: средний лог-рост монеты через 30/90 дней после дня режима минус средний по всем дням той же монеты
      (среднее по монетам, где режим был ≥ 10 дней; 181 монета: отбор, экзамен, 50 случайных, 100 новых) + то же у BTC.
      Устойчивость: без 2020-03 (15.02–15.06.2020), без 2022 (весь год), без 2025-10 (15.09.2025–15.01.2026), по половинам (до/после 2021-07-01).
      Эпизоды — число отдельных отрезков режима (разрыв > 10 дн) по календарю.
   Б) Где combo6 слаба: сделки combo6 (сдвиг 0) по семьям правил — средний избыточный лог-рост монеты за 90 дн после сделки, по режимам рынка акций.
      Для продажи плюс = продали перед ростом (плохо), для покупки плюс = хорошо. Запуск: node st_r1.js */
const ST = require('./st_lib.js'), { M, T0, T, BY, P, S6, polW, FAM } = ST;
const XS = ST.ALL();
const EXC = { 'все': () => true, 'без 2020-03': (t) => !(t >= T('2020-02-15') && t < T('2020-06-15')), 'без 2022': (t) => !(t >= T('2022-01-01') && t < T('2023-01-01')),
  'без 2025-10': (t) => !(t >= T('2025-09-15') && t < T('2026-01-15')), 'до 2021-07': (t) => t < T('2021-07-01'), 'после 2021-07': (t) => t >= T('2021-07-01') };
const H2 = [30, 90];
function stat(f, keep = () => true, xs = XS) {
  const acc = H2.map(() => []); let days = 0, nc = 0;
  for (const X of xs) { const I = X.ind, c = X.c, n = X.n; let dd = 0;
    H2.forEach((h, q) => { let s = 0, m = 0, sa = 0, ma = 0; for (let j = 120; j + h < n; j++) { const t = I.t[j]; if (!keep(t)) continue; const r = Math.log(c[j + h] / c[j]); if (!isFinite(r)) continue; sa += r; ma++; if (f(I, j)) { s += r; m++; } }
      if (m >= 10 && ma > 0) acc[q].push(s / m - sa / ma); if (q === 1) dd = m; });
    if (dd >= 10) { days += dd; nc++; } }
  const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length * 100 : NaN);
  return { e30: mean(acc[0]), e90: mean(acc[1]), pos: acc[1].filter((x) => x > 0).length, n: acc[1].length, dpc: nc ? days / nc : 0 };
}
// эпизоды по календарю (на ряду BTC — у него самая длинная история)
function episodes(f) { const X = BY.BTC, I = X.ind; let cnt = 0, last = -1e9, days = 0; for (let j = 0; j < X.n; j++) if (f(I, j)) { if (j - last > 10) cnt++; last = j; days++; } return { cnt, days }; }
const f1 = (x) => (isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(1) : '  —');
const REG = [];
const add = (nm, f) => REG.push([nm, f]);
const bins = (k, edges, lab = k) => { for (let q = 0; q <= edges.length; q++) { const a = q ? edges[q - 1] : -Infinity, b = q < edges.length ? edges[q] : Infinity; add(`${lab} ${q ? a : ''}…${q < edges.length ? b : ''}`, (I, j) => I[k][j] >= a && I[k][j] < b); } };
add('все дни', () => true);
bins('st_bxr30', [-20, -5, 5, 20], 'BTC−NDX 30д');
bins('st_bxr90', [-40, -15, 15, 40], 'BTC−NDX 90д');
bins('st_bxz', [-30, -10, 10, 30], 'лог BTC/NDX к 200д');
bins('st_cxr90', [-60, -20, 20, 60], 'монета−NDX 90д');
bins('st_bxc90', [0.15, 0.35, 0.5], 'корр BTC–NDX 90');
bins('st_ndx200', [0.95, 1, 1.1], 'NDX/200д');
add('S&P −5% за 7 дн', (I, j) => I.st_spxr7[j] < -5); add('NDX −10% за 30 дн', (I, j) => I.st_ndxr30[j] < -10);
add('VIX > 30', (I, j) => I.st_vix[j] > 30); add('VIX > 40', (I, j) => I.st_vix[j] > 40); add('VIX / 50д > 1,5', (I, j) => I.st_vixr[j] > 1.5);
add('корр > 0,4 и NDX −8% за 30 дн', (I, j) => I.st_bxc90[j] > 0.4 && I.st_ndxr30[j] < -8);
add('акции у макс. (≤3%), BTC −25% от года', (I, j) => I.st_bxdiv[j] > 0.5);
add('NDX у макс. (≤3%) и BTC−NDX 90д < −15', (I, j) => I.st_ndxdd[j] < 3 && I.st_bxr90[j] < -15);
add('NDX > 200д и BTC < 200д', (I, j) => I.st_ndx200[j] > 1 && I.btc200[j] < 1); add('NDX < 200д и BTC < 200д', (I, j) => I.st_ndx200[j] < 1 && I.btc200[j] < 1);
add('NDX < 200д и BTC > 200д', (I, j) => I.st_ndx200[j] < 1 && I.btc200[j] > 1); add('NDX > 200д и BTC > 200д', (I, j) => I.st_ndx200[j] > 1 && I.btc200[j] > 1);
bins('st_dxyr90', [-4, 4], 'DXY 90д'); add('DXY > 200д ×1,03', (I, j) => I.st_dxy200[j] > 1.03);
bins('st_tnxd90', [-0.5, 0.5], 'ставка 10л Δ90д');
add('золото +10% за 90 дн', (I, j) => I.st_gldr90[j] > 10); add('NVDA < 200д', (I, j) => I.st_nvda200[j] < 1);
console.log('А) избыточный лог-рост, % (режим минус все дни монеты), среднее по монетам; 90д — по вариантам истории; BTC — только BTC');
console.log(`${'режим'.padEnd(40)} эпиз  дн/мон | 30д   90д (выше/монет) | без20-03 без2022 без25-10 | до21-07 после | BTC 30д  90д`);
const out = [];
for (const [nm, f] of REG) {
  const a = stat(f), ep = episodes(f), v = ['без 2020-03', 'без 2022', 'без 2025-10', 'до 2021-07', 'после 2021-07'].map((k) => stat(f, EXC[k]).e90), b = stat(f, () => true, [BY.BTC]);
  out.push({ nm, a, ep, v, b });
  console.log(`${nm.padEnd(40)} ${String(ep.cnt).padStart(4)} ${String(Math.round(a.dpc)).padStart(6)} | ${f1(a.e30).padStart(5)} ${f1(a.e90).padStart(6)} (${a.pos}/${a.n}) | ${v.slice(0, 3).map((x) => f1(x).padStart(7)).join(' ')} | ${v.slice(3).map((x) => f1(x).padStart(6)).join(' ')} | ${f1(b.e30).padStart(6)} ${f1(b.e90).padStart(6)}`);
}
// Б) сделки combo6 по семьям и режимам
console.log('\nБ) сделки combo6 (сдвиг 0, 181 монета): средний избыточный лог-рост монеты за 90 дн после сделки, % (число сделок)');
const SPL = [['NDX>200д', (I, j) => I.st_ndx200[j] > 1], ['NDX<200д', (I, j) => I.st_ndx200[j] < 1], ['BTC−NDX90<−15', (I, j) => I.st_bxr90[j] < -15], ['BTC−NDX90>+15', (I, j) => I.st_bxr90[j] > 15],
  ['корр90>0,4', (I, j) => I.st_bxc90[j] > 0.4], ['корр90<0,25', (I, j) => I.st_bxc90[j] < 0.25], ['NDX у макс ≤3%', (I, j) => I.st_ndxdd[j] < 3], ['NDX −10% от макс', (I, j) => I.st_ndxdd[j] > 10],
  ['VIX>25', (I, j) => I.st_vix[j] > 25], ['монета−NDX90<−40', (I, j) => I.st_cxr90[j] < -40], ['монета−NDX90>+40', (I, j) => I.st_cxr90[j] > 40]];
const FAMS = ['buy', 'guard', 'fear', 'rev', 'fund', 'qt', 'top', 'b60', 'pump', 'alt', 'euph', 'wick'];
const acc = {}; const put = (k, s, v, amt) => { const o = (acc[k] = acc[k] || {}); const z = (o[s] = o[s] || { n: 0, s: 0, w: 0, sw: 0 }); z.n++; z.s += v; z.w += amt; z.sw += v * amt; };
for (const X of XS) {
  const I = X.ind, c = X.c, n = X.n; let sa = 0, ma = 0; for (let j = 120; j + 90 < n; j++) { const r = Math.log(c[j + 90] / c[j]); if (isFinite(r)) { sa += r; ma++; } } const base = ma ? sa / ma : 0;
  const { tr } = P.edge(X, S6, 0, 'full', true, polW);
  for (const t of tr) { if (t.i + 90 >= n) continue; const j = t.i - 1, fam = t.q >= 0 ? FAM(t.q) : 'wick', v = (Math.log(c[t.i + 90] / c[t.i]) - base) * 100; if (!isFinite(v)) continue;
    const k = fam + (t.s > 0 ? ' куп' : ' прод'); put(k, 'все', v, t.amt); for (const [s, f] of SPL) if (f(I, j)) put(k, s, v, t.amt); }
}
console.log(`${'семья'.padEnd(12)} ${['все', ...SPL.map((x) => x[0])].map((s) => s.padStart(16)).join('')}`);
for (const k of Object.keys(acc).sort()) console.log(`${k.padEnd(12)} ${['все', ...SPL.map((x) => x[0])].map((s) => { const z = acc[k][s]; return (z ? `${f1(z.s / z.n)}(${z.n})` : '—').padStart(16); }).join('')}`);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/st/r1.json', JSON.stringify({ out, acc }));
