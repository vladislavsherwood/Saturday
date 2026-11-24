/* au, круг 1: диагностика лид-лаг «золото ↔ крипта» в обе стороны (research/au_journal.md).
   1) кросс-корреляции доходностей BTC и золота (серебра): дневные (между соседними торговыми днями золота; BTC за тот же отрезок),
      недельные и 30-дневные непересекающиеся, лаги 1–30 / 1–8 / 1–4, по эпохам;
   2) события золота → форвардный лог-рост монет за 30/90 дней сверх обычного (среднее по монетам; BTC отдельно; эпохи; без любого года);
   3) события крипты → форвардный рост золота за 30/90 дней сверх обычного.
   Запуск: node au_r1.js > scratchpad/au/r1.txt */
const fs = require('fs');
const A = require('./au_lib.js'), { T, day, T0, AU, AG, XS, BY } = A;
const rd = (f) => fs.readFileSync(__dirname + '/../dca/cache/' + f, 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const calOf = (rows) => { const o = new Float64Array(AU.length).fill(NaN); for (const [d, x] of rows) { const k = T(d) - T0; if (k >= 0 && k < o.length && +x > 0) o[k] = +x; } for (let i = 1; i < o.length; i++) if (!isFinite(o[i]) && isFinite(o[i - 1]) && i > 0) o[i] = o[i - 1]; return o; };
const BTC = calOf(rd('BTC-USD.csv')), ETH = calOf(rd('ETH-USD.csv'));
const EP = [['2015–17', '2014-09-17', '2017-12-31'], ['2018–19', '2018-01-01', '2019-12-31'], ['2020–21', '2020-01-01', '2021-12-31'], ['2022–23', '2022-01-01', '2023-12-31'], ['2024–26', '2024-01-01', '2026-12-31']];
const corr = (x, y) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; for (let i = 0; i < x.length; i++) { const a = x[i], b = y[i]; if (!isFinite(a) || !isFinite(b)) continue; n++; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; } const c = (sxy / n - (sx / n) * (sy / n)) / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2)); return { r: c, n }; };
// ряды доходностей на сетке: шаг — торговые дни золота (step 'd') или каждые k календарных дней
function grid(step) {
  const idx = []; if (step === 'd') { const td = new Set(A.MK['GC=F'].d.map(T)); for (let i = 0; i < AU.length; i++) if (td.has(T0 + i)) idx.push(i); } else for (let i = 0; i < AU.length; i += step) idx.push(i);
  const r = (S) => idx.map((i, k) => (k ? Math.log(S[i] / S[idx[k - 1]]) : NaN));
  return { idx, g: r(AU), s: r(AG), b: r(BTC), e: r(ETH) };
}
// лаг L > 0: x ведёт y (x[k] против y[k+L]); эпоха — по дню x
function lagc(Gd, x, y, L, ep) { const a = [], b = []; for (let k = 0; k + L < Gd.idx.length; k++) { const t = T0 + Gd.idx[k]; if (ep && (t < T(ep[1]) || t > T(ep[2]))) continue; a.push(Gd[x][k]); b.push(Gd[y][k + L]); } return corr(a, b); }
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
console.log('=== 1. Кросс-корреляции (r; * — |r| > 2/√N) ===');
for (const [nm, step, lags] of [['дневные (торговые дни золота)', 'd', [0, 1, 2, 3, 4, 5, 7, 10, 15, 20, 30]], ['недельные', 7, [0, 1, 2, 3, 4, 6, 8]], ['30-дневные', 30, [0, 1, 2, 3]]]) {
  const Gd = grid(step);
  for (const [x, y, lab] of [['g', 'b', 'золото → BTC'], ['b', 'g', 'BTC → золото'], ['s', 'b', 'серебро → BTC'], ['b', 's', 'BTC → серебро'], ['g', 'e', 'золото → ETH'], ['e', 'g', 'ETH → золото']]) {
    const row = (ep) => lags.map((L) => { const { r, n } = lagc(Gd, x, y, L, ep); return isFinite(r) ? f2(r) + (Math.abs(r) > 2 / Math.sqrt(n) ? '*' : ' ') : '  —  '; }).join(' ');
    console.log(`${nm.padEnd(30)} ${lab.padEnd(15)} лаги ${lags.join(',')}`);
    console.log(`   вся история       ${row(null)}`);
    for (const ep of EP) console.log(`   ${ep[0].padEnd(17)} ${row(ep)}`);
  }
}
// сводка по дневным лагам 1–30: сколько значимых, какие повторяются по эпохам
{ const Gd = grid('d');
  for (const [x, y, lab] of [['g', 'b', 'золото → BTC'], ['b', 'g', 'BTC → золото']]) {
    const sig = [], rep = []; for (let L = 1; L <= 30; L++) { const all = lagc(Gd, x, y, L); if (Math.abs(all.r) > 2 / Math.sqrt(all.n)) sig.push(`${L}:${f2(all.r)}`);
      const s = EP.map((ep) => lagc(Gd, x, y, L, ep).r); const pos = s.filter((v) => v > 0.03).length, neg = s.filter((v) => v < -0.03).length; if (pos >= 3 || neg >= 3) rep.push(`${L}:${pos}+/${neg}−`); }
    console.log(`${lab}: значимые лаги 1–30 по всей истории — ${sig.join(' ') || 'нет'}; лаги, где ≥3 из 5 эпох одного знака (|r|>0,03) — ${rep.join(' ') || 'нет'}`);
  }
  // одновременная корреляция по годам
  const yr = []; for (let y = 2015; y <= 2026; y++) { const r = lagc(Gd, 'g', 'b', 0, ['', `${y}-01-01`, `${y}-12-31`]).r; yr.push(`${y} ${f2(r)}`); } console.log('одновременная r(золото, BTC) по годам:', yr.join(' | '));
  // хвосты: большой дневной ход золота → BTC завтра / через 5 дней
  const sd = Math.sqrt(Gd.g.filter(isFinite).reduce((s, v) => s + v * v, 0) / Gd.g.filter(isFinite).length);
  for (const [lab, f] of [['золото > +2σ за день', (v) => v > 2 * sd], ['золото < −2σ за день', (v) => v < -2 * sd]]) {
    const n1 = [], n5 = []; for (let k = 1; k + 5 < Gd.idx.length; k++) if (f(Gd.g[k]) && isFinite(Gd.b[k + 1])) { n1.push(Gd.b[k + 1]); let s = 0; for (let q = 1; q <= 5; q++) s += Gd.b[k + q]; n5.push(s); }
    const m = (a) => (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(2); console.log(`${lab} (σ ${(sd * 100).toFixed(2)}%, ${n1.length} дней): BTC след. торг. день ${m(n1)}%, 5 дней ${m(n5)}% (обычно: ${m(Gd.b.filter(isFinite))}% / ${(Gd.b.filter(isFinite).reduce((x, y) => x + y, 0) / Gd.b.filter(isFinite).length * 500).toFixed(2)}%)`);
  }
}
// === 2. события золота → монеты ===
const H = [30, 90];
const yearOf = (t) => +day(t).slice(0, 4);
function ev(nm, f) {
  // f(I, j) → событие в день j (известно к закрытию дня j)
  const per = H.map(() => []), btc = H.map(() => null), byEp = H.map(() => EP.map(() => [])), byYr = {}; let days = 0; const evDays = new Set();
  for (const X of XS) {
    const I = X.ind, c = X.c, n = X.n;
    H.forEach((h, q) => {
      let s = 0, m = 0, sa = 0, ma = 0; const es = EP.map(() => [0, 0, 0, 0]), ys = {};
      for (let j = 60; j + h < n; j++) { const r = Math.log(c[j + h] / c[j]); if (!isFinite(r)) continue; const t = I.t[j], e = EP.findIndex((p) => t >= T(p[1]) && t <= T(p[2])); sa += r; ma++; if (e >= 0) { es[e][2] += r; es[e][3]++; }
        const y = yearOf(t); ys[y] = ys[y] || [0, 0, 0, 0]; ys[y][2] += r; ys[y][3]++;
        if (f(I, j)) { s += r; m++; if (e >= 0) { es[e][0] += r; es[e][1]++; } ys[y][0] += r; ys[y][1]++; if (q === 0) { days++; evDays.add(t); } } }
      if (m >= 5) { per[q].push(s / m - sa / ma); if (X.name === 'BTC' && X.grp === 'sel') btc[q] = { x: s / m - sa / ma, m }; }
      es.forEach((v, e) => { if (v[1] >= 5) byEp[q][e].push(v[0] / v[1] - sa / ma); });
      // без года Y: избыток без событий года Y
      for (const y in ys) { byYr[y] = byYr[y] || H.map(() => []); if (m - ys[y][1] >= 5) byYr[y][q].push((s - ys[y][0]) / (m - ys[y][1]) - sa / ma); }
    });
  }
  const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN), pc = (v) => (isFinite(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%' : '—');
  // эпизоды: календарные дни событий, разрыв > 30 дней — новый эпизод
  const ds = [...evDays].sort((a, b) => a - b); const eps = []; for (const t of ds) { if (!eps.length || t - eps[eps.length - 1][1] > 30) eps.push([t, t]); else eps[eps.length - 1][1] = t; }
  const loo = H.map((h, q) => { const v = Object.keys(byYr).map((y) => [y, mean(byYr[y][q])]).filter(([, x]) => isFinite(x)); v.sort((a, b) => a[1] - b[1]); return v.length ? `${pc(v[0][1])} (без ${v[0][0]}) … ${pc(v[v.length - 1][1])} (без ${v[v.length - 1][0]})` : '—'; });
  console.log(`${nm.padEnd(46)} монет ${String(per[0].length).padStart(3)} эпизодов ${String(eps.length).padStart(3)} | ` + H.map((h, q) => `${h}д ${pc(mean(per[q]))} (${per[q].filter((x) => x > 0).length}/${per[q].length}) BTC ${btc[q] ? pc(btc[q].x) : '—'}`).join(' | '));
  console.log(`${''.padEnd(46)} эпохи 30д: ${EP.map((p, e) => `${p[0]} ${pc(mean(byEp[0][e]))}`).join(' ')} | 90д: ${EP.map((p, e) => `${pc(mean(byEp[1][e]))}`).join(' ')}`);
  console.log(`${''.padEnd(46)} без одного года: 30д ${loo[0]} | 90д ${loo[1]} | эпизоды: ${eps.slice(0, 14).map(([a, b]) => day(a).slice(0, 7) + (b - a > 20 ? '…' + day(b).slice(2, 7) : '')).join(' ')}${eps.length > 14 ? ' …' : ''}`);
}
console.log('\n=== 2. События золота/серебра → форвардный лог-рост монет сверх обычного (среднее по монетам, в скобках — монет > 0; BTC отдельно) ===');
const G = {
  'золото на рекорде (≤5 дн. от рекорда)': (I, j) => I.au_hid[j] <= 5,
  'золото на рекорде, BTC ниже −25% от своего': (I, j) => I.au_hid[j] <= 5 && I.btcath[j] > 25,
  'золото на рекорде, BTC/золото за 90д < −20%': (I, j) => I.au_hid[j] <= 5 && I.bg_r90[j] < -20,
  'золото на 250-дн. максимуме': (I, j) => I.au_hi250[j] > 0.5,
  'золото +3% за неделю': (I, j) => I.au_r7[j] > 3,
  'золото +6% за месяц': (I, j) => I.au_r30[j] > 6,
  'золото +10% за месяц': (I, j) => I.au_r30[j] > 10,
  'золото −3% за неделю': (I, j) => I.au_r7[j] < -3,
  'золото −5% за месяц': (I, j) => I.au_r30[j] < -5,
  'золото −10% от рекорда': (I, j) => I.au_ath[j] > 10,
  'золото −15% от рекорда': (I, j) => I.au_ath[j] > 15,
  'разворот вниз: рекорд 10–60 дн. назад, −5% от него': (I, j) => I.au_hid[j] >= 10 && I.au_hid[j] <= 60 && I.au_ath[j] > 5,
  'разворот вверх: −10% от рекорда, +5% за месяц': (I, j) => I.au_ath[j] > 8 && I.au_r30[j] > 5,
  'вместе вниз: золото −3%/30д, BTC −15%/30д': (I, j) => I.au_r30[j] < -3 && I.btcr30[j] < -15,
  'вместе вниз: золото −2%/7д, BTC −10%/7д': (I, j) => I.au_r7[j] < -2 && I.btcr30[j] < -10 && I.ret30 && I.btcr14[j] < -10,
  'бегство в защиту: золото +5%/30д, BTC −10%/30д': (I, j) => I.au_r30[j] > 5 && I.btcr30[j] < -10,
  'золото +5%/30д, BTC +10%/30д': (I, j) => I.au_r30[j] > 5 && I.btcr30[j] > 10,
  'BTC/золото < 0,75 своей 200д': (I, j) => I.bg_s200[j] < 0.75,
  'BTC/золото < 0,85 своей 365д': (I, j) => I.bg_s365[j] < 0.85,
  'BTC/золото > 1,4 своей 200д': (I, j) => I.bg_s200[j] > 1.4,
  'BTC/золото −30% за 90д': (I, j) => I.bg_r90[j] < -30,
  'корреляция BTC–золото 90д > 0,3': (I, j) => I.au_c90[j] > 0.3,
  'корреляция BTC–золото 90д < −0,1': (I, j) => I.au_c90[j] < -0.1,
  'серебро +15% за месяц': (I, j) => I.ag_r30[j] > 15,
  'серебро −10% за месяц': (I, j) => I.ag_r30[j] < -10,
  'серебро на рекорде (≤3% от рекорда)': (I, j) => I.ag_ath[j] < 3,
  'серебро/золото растёт: серебро − золото > +8% за 30д': (I, j) => I.ag_r30[j] - I.au_r30[j] > 8,
  'серебро/золото падает: серебро − золото < −8% за 30д': (I, j) => I.ag_r30[j] - I.au_r30[j] < -8,
};
for (const [nm, f] of Object.entries(G)) ev(nm, f);
// === 3. события крипты → форвардный рост золота ===
console.log('\n=== 3. События крипты → форвардный лог-рост золота (GC=F) за 30/90 дней сверх обычного (тот же период, дни с данными BTC стенда) ===');
const BX = BY.BTC, I = BX.ind;
function gev(nm, f, M = AU, lab = 'золото') {
  const out = []; for (const h of [30, 90]) { let s = 0, m = 0, sa = 0, ma = 0; const es = EP.map(() => [0, 0, 0, 0]), ys = {};
    for (let j = 60; j < BX.n; j++) { const k = BX.t[j] - T0; if (k + h >= M.length || !isFinite(M[k + h])) continue; const r = Math.log(M[k + h] / M[k]); if (!isFinite(r)) continue; const e = EP.findIndex((p) => BX.t[j] >= T(p[1]) && BX.t[j] <= T(p[2])); sa += r; ma++; if (e >= 0) { es[e][2] += r; es[e][3]++; }
      const y = yearOf(BX.t[j]); ys[y] = ys[y] || [0, 0]; if (f(I, j)) { s += r; m++; ys[y][0] += r; ys[y][1]++; if (e >= 0) { es[e][0] += r; es[e][1]++; } } }
    const base = sa / ma, x = m ? s / m - base : NaN, lo = Object.keys(ys).map((y) => (m - ys[y][1] >= 5 ? (s - ys[y][0]) / (m - ys[y][1]) - base : NaN)).filter(isFinite);
    out.push(`${h}д ${m ? ((x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%') : '—'} [эпохи ${es.map((v) => (v[1] >= 5 ? ((v[0] / v[1] - v[2] / v[3]) * 100).toFixed(1) : '—')).join(' ')}] без года ${lo.length ? (Math.min(...lo) * 100).toFixed(1) + '…' + (Math.max(...lo) * 100).toFixed(1) : '—'}`); }
  let d = 0; for (let j = 60; j < BX.n; j++) if (f(I, j)) d++;
  console.log(`${(lab + ': ' + nm).padEnd(52)} дней ${String(d).padStart(4)} | ${out.join(' | ')}`);
}
const CR = {
  'BTC −25% за 30 дней': (I, j) => I.btcr30[j] < -25,
  'BTC −15% за 14 дней': (I, j) => I.btcr14[j] < -15,
  'BTC +30% за 30 дней': (I, j) => I.btcr30[j] > 30,
  'BTC у рекорда (< 5% от него)': (I, j) => I.btcath[j] < 5,
  'BTC −50% от рекорда': (I, j) => I.btcath[j] > 50,
  'страх < 10': (I, j) => I.fng[j] < 10,
  'страх < 20': (I, j) => I.fng[j] < 20,
  'жадность > 80': (I, j) => I.fng[j] > 80,
  'паника в стейблах (usdt > 1,07 и othd < 25)': (I, j) => I.usdt[j] > 1.07 && I.othd[j] < 25,
  'эйфория в стейблах (usdt < 0,9)': (I, j) => I.usdt[j] < 0.9,
  'волна ликвидаций (oidd30 < −28)': (I, j) => I.oidd30[j] < -28,
  'BTC ниже 200д и падает (btc200 < 0,85)': (I, j) => I.btc200[j] < 0.85,
  'BTC выше 200д на 30% (btc200 > 1,3)': (I, j) => I.btc200[j] > 1.3,
  'BTC/золото −30% за 90д': (I, j) => I.bg_r90[j] < -30,
  'BTC/золото +40% за 90д': (I, j) => I.bg_r90[j] > 40,
};
for (const [nm, f] of Object.entries(CR)) gev(nm, f);
for (const nm of ['BTC −25% за 30 дней', 'BTC +30% за 30 дней', 'страх < 10', 'паника в стейблах (usdt > 1,07 и othd < 25)', 'BTC у рекорда (< 5% от него)']) gev(nm, CR[nm], A.AG, 'серебро');
