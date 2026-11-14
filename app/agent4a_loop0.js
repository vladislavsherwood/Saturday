/* Агент 4A, круг 0: пересчёт W25 и разбор покупок резерва у дна.
   1) по правилам покупки: доля денег резерва, выше 90-дн. будущего минимума, в зоне +15% от дна цикла;
   2) крупные дна (минимум ±180 дней и −50% от максимума прошлого года): сколько резерва было потрачено ДО дна (за 365 дней до него),
      сколько ПОСЛЕ (до +120 дней), сколько денег лежало в резерве в день дна к максимуму резерва за прошлый год,
      цена покупок до дна к цене дна. Будущее — только для оценки. Запуск: node app/agent4a_loop0.js */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25);
console.log(A.HDR); console.log(A.row('W25', base, base)); console.log(A.fmtM(base.m));
const R = A.W25.rules, coins = [...G.sel, ...G.ex, ...G.rnd];
const per = R.map(() => ({ amt: 0, ab: 0, z: 0, k: 0 }));
let bots = 0, cashAtBot = 0, spentBefore = 0, spentAfter = 0, pBefore = 0, wBefore = 0, empty = 0, buysBelow = 0;
const lagD = []; // дни от первой покупки резерва в окне −365..+120 до дна
for (const X of coins) {
  const M = A.S.edge ? null : null;
  const { tr } = A.edge(X, A.W25, 0, 'full', true);
  // кэш по дням: повторим расчёт кэша (edge не отдаёт) — простая повторная симуляция
  const cash = new Float64Array(X.n); { let cs = 0, u = 0; const ev = new Map(tr.map((t) => [t.i + ':' + t.s, t]));
    for (let i = 0; i < X.n; i++) { cs += 10; const b = ev.get(i + ':1'), s = ev.get(i + ':-1'); if (s) cs += s.amt * 0.999; if (b) cs -= b.amt; cash[i] = cs; } }
  const MM = A.S.metrics ? null : null;
  const c = X.c, mF = (() => { const o = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = Infinity; for (let j = i; j <= Math.min(X.n - 1, i + 90); j++) m = Math.min(m, c[j]); o[i] = m; } return o; })();
  const mW = A.rollMin(c, 361), mWc = new Float64Array(X.n); for (let i = 0; i < X.n; i++) mWc[i] = mW[Math.min(X.n - 1, i + 180)];
  for (const t of tr) if (t.s > 0) { const p = per[t.q]; p.amt += t.amt; p.ab += t.amt * (t.p / mF[t.i] - 1); if (t.p <= 1.15 * mWc[t.i]) p.z += t.amt; p.k++; }
  const pmax = A.rollMax(c, 365);
  for (let i = 200; i < X.n - 30; i++) {
    if (c[i] !== mWc[i] || c[i] > 0.5 * pmax[Math.max(0, i - 1)]) continue;
    bots++; let mx = 0; for (let j = Math.max(0, i - 365); j <= i; j++) mx = Math.max(mx, cash[j]); cashAtBot += mx > 0 ? cash[i] / mx : 1; if (mx > 0 && cash[i] < 0.1 * mx) empty++;
    let sb = 0, sa = 0, first = null;
    for (const t of tr) if (t.s > 0) { if (t.i > i - 365 && t.i <= i) { sb += t.amt; pBefore += t.amt * (t.p / c[i]); wBefore += t.amt; if (first == null) first = t.i; } if (t.i > i && t.i <= i + 120) { sa += t.amt; if (t.p <= 1.15 * c[i]) buysBelow += t.amt; } }
    spentBefore += sb; spentAfter += sa; if (first != null) lagD.push(i - first);
  }
}
const tot = per.reduce((s, p) => s + p.amt, 0);
console.log('\nпокупки резерва по правилам W25 (доля денег / выше мин90 / в зоне +15% / сделок):');
R.forEach((r, q) => { const p = per[q]; if (p.k) console.log(`  #${q} act ${r.act} [${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')}]: ${(100 * p.amt / tot).toFixed(1)}% / ${(100 * p.ab / p.amt).toFixed(0)}% / ${(100 * p.z / p.amt).toFixed(0)}% / ${p.k}`); });
console.log(`\nкрупных доньев: ${bots}; резерв в день дна к максимуму резерва за год до него: ${(100 * cashAtBot / bots).toFixed(0)}% (почти пуст < 10%: ${(100 * empty / bots).toFixed(0)}% доньев)`);
console.log(`резерв потрачен за 365 дней ДО дна: ${(100 * spentBefore / (spentBefore + spentAfter)).toFixed(0)}%, за 120 дней ПОСЛЕ: ${(100 * spentAfter / (spentBefore + spentAfter)).toFixed(0)}%; цена покупок до дна к цене дна ×${(pBefore / wBefore).toFixed(2)}; после дна в зоне +15%: ${(100 * buysBelow / spentAfter).toFixed(0)}%`);
lagD.sort((a, b) => a - b); console.log(`первая покупка резерва за N дней до дна: медиана ${lagD[lagD.length >> 1]}, четверти ${lagD[lagD.length >> 2]} / ${lagD[(3 * lagD.length) >> 2]}`);
