/* h4: признаки покупок из резерва (паника и выдача долга, разворот BTC 27, капитуляция 1, вынос 2–3) и их исход.
   Исход (взвешено долей капитала монеты в день покупки): падение до минимума следующих 120 дней, %; лог-рост цены через 180 и 365 дней; «лучше подождать»: ln(p / min цены за 120 дн.).
   Корзины по признаку накануне: rel90, rel180, oth90, sma200 (монета к своей 200д), btc200, dd365 (монета от 365-дн. максимума), epn, год.
   Запуск: node h4_feat.js [fam=pan|rev|all] [n100] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const args = process.argv.slice(2), FAMA = (args.find((a) => a.startsWith('fam=')) || 'fam=pan').slice(4), N100 = args.includes('n100');
const lists = N100 ? ['n100'] : ['sel', 'ex', 'rnd'];
const rows = [];
for (const g of lists) for (const X of G[g]) {
  const pol = { ...L.pol0, trace: [], wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } };
  const { tr } = P.edge(X, S, 0, 'full', true, pol); const c = X.c, n = X.n, I = X.ind, T = pol.trace;
  const Rc = S.rules.filter((r) => r.conds.every((cd) => I[cd.ind])), oi = Rc.map((r) => S.rules.indexOf(r) + 1);
  for (const t of tr) {
    if (t.s < 0 || t.i + 120 >= n) continue;
    const k = oi[t.q], fam = t.pan || (k >= 4 && k <= 9) ? 'pan' : k === 27 ? 'rev' : k === 1 ? 'cap' : k === 2 || k === 3 ? 'liq' : 'oth';
    if (FAMA !== 'all' && fam !== FAMA) continue;
    const j = t.i - 1; let mn = c[t.i]; for (let q = t.i; q <= t.i + 120; q++) mn = Math.min(mn, c[q]);
    rows.push({ w: t.amt / (T[t.i - 1][1] + T[t.i - 1][2] * c[t.i - 1]), fall: (1 - mn / c[t.i]) * 100, f180: t.i + 180 < n ? Math.log(c[t.i + 180] / c[t.i]) : NaN, f365: t.i + 365 < n ? Math.log(c[t.i + 365] / c[t.i]) : NaN,
      rel90: I.rel90[j], rel180: I.rel180[j], oth90: I.oth90[j], sma200: I.sma200[j], btc200: I.btc200[j], dd365: I.dd365 ? I.dd365[j] : NaN, epn: I.epn[j], yr: L.day(I.t[t.i]).slice(0, 4), fam, nm: X.name });
  }
}
const W = (a, f) => { let w = 0, s = 0; for (const r of a) if (isFinite(r[f])) { w += r.w; s += r.w * r[f]; } return s / w; };
const tot = rows.reduce((s, r) => s + r.w, 0);
const line = (lab, a) => `${lab.padEnd(18)} денег ${((100 * a.reduce((s, r) => s + r.w, 0)) / tot).toFixed(0).padStart(3)}% n ${String(a.length).padStart(5)} монет ${String(new Set(a.map((r) => r.nm)).size).padStart(3)} | падение ${W(a, 'fall').toFixed(1).padStart(5)}% | лог 180д ${W(a, 'f180').toFixed(2).padStart(6)} | 365д ${W(a, 'f365').toFixed(2).padStart(6)}`;
console.log(`семья ${FAMA}, ${lists.join('+')}, combo4 + фитили, сдвиг 0`);
console.log(line('все', rows));
const B = (f, cuts) => { console.log(`— ${f}`); const cs = [-Infinity, ...cuts, Infinity]; for (let q = 0; q + 1 < cs.length; q++) { const a = rows.filter((r) => r[f] >= cs[q] && r[f] < cs[q + 1]); if (a.length) console.log(line(`  ${cs[q]}…${cs[q + 1]}`, a)); } };
B('rel90', [-40, -25, -15, 0, 15, 40]); B('rel180', [-50, -30, -15, 0, 30]); B('oth90', [-3, -1.5, 0, 1.5, 3]); B('sma200', [0.6, 0.8, 1, 1.2, 1.5]); B('btc200', [0.8, 1, 1.2, 1.5]);
B('dd365', [20, 40, 60, 80]); B('epn', [1, 2, 4, 8]);
console.log('— год'); for (const y of [...new Set(rows.map((r) => r.yr))].sort()) console.log(line('  ' + y, rows.filter((r) => r.yr === y)));
