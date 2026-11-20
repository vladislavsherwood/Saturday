/* h4: «цена» сделок года по семьям правил. Для каждой сделки из резерва (покупка сверх взноса, выдача долга, фитиль) и каждой продажи:
   покупка: amt × (p_к / p − 1) — выигрыш против «держать деньги в резерве» до даты к (конец года / через 365 дней / конец следующего года);
   продажа: −amt × (p_к / p − 1). Сумма по монете делится на капитал на начало года, по семьям; печатаются медиана и среднее по монетам.
   (Грубо: не учитывает, что отложенные деньги потом потратились бы иначе.) Запуск: node h4_attr.js 2019 [nowick] [n100] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const args = process.argv.slice(2), NW = args.includes('nowick'), N100 = args.includes('n100'), YS = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
const lists = N100 ? ['n100'] : ['sel', 'ex', 'rnd'];
const R_ = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FAM = [['кап1', [1]], ['вынос2-3', [2, 3]], ['паника4-9', R_(4, 9)], ['охрана10', [10]], ['сильстрах11-18', R_(11, 18)], ['страх19-26', R_(19, 26)], ['развBTC27', [27]], ['фанд28-30', R_(28, 30)],
  ['тихвер31-50', R_(31, 50)], ['возврат51', [51]], ['памп52-54', R_(52, 54)], ['альтсез55', [55]], ['эйф56-57', [56, 57]]];
const famOf = (k) => { for (const [nm, ids] of FAM) if (ids.includes(k + 1)) return nm; return '?'; };
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const mean = (v) => { const a = v.filter(isFinite); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN; };
for (const Y of YS) {
  const H = { ye: {}, y1: {}, ny: {} }, cnt = {};
  for (const g of lists) for (const X of G[g]) {
    const pol = { ...L.pol0, trace: [], ...(NW ? {} : { wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place', log: [] } }) };
    const { tr } = P.edge(X, S, 0, 'full', true, pol); const T = pol.trace, c = X.c, n = X.n, I = X.ind;
    const Rc = S.rules.filter((r) => r.conds.every((cd) => I[cd.ind])), oi = Rc.map((r) => S.rules.indexOf(r));
    const yOf = (i) => +L.day(I.t[i]).slice(0, 4);
    let a = -1, b = -1, e2 = -1; for (let i = 0; i < n; i++) { if (yOf(i) === Y) { if (a < 0) a = i; b = i; } if (yOf(i) === Y + 1) e2 = i; }
    if (a <= 0 || b < 120) continue;
    const V0 = T[a - 1][1] + T[a - 1][2] * c[a - 1];
    const ev = []; for (const t of tr) if (t.i >= a && t.i <= b) ev.push([t.i, t.s, t.amt, t.pan && !(oi[t.q] >= 3 && oi[t.q] <= 8) ? 'долг' : famOf(oi[t.q])]);
    if (pol.wick) for (const [, i, k, amt] of pol.wick.log) if (i >= a && i <= b) ev.push([i, 1, amt, 'фитили']);
    const acc = { ye: {}, y1: {}, ny: {} };
    for (const [i, s, amt, f] of ev) {
      const p = c[i], k1 = Math.min(n - 1, i + 365);
      for (const [key, pe] of [['ye', c[b]], ['y1', c[k1]], ['ny', e2 > 0 ? c[e2] : NaN]]) acc[key][f] = (acc[key][f] || 0) + s * amt * (pe / p - 1) / V0;
    }
    for (const key in acc) for (const f in acc[key]) (H[key][f] = H[key][f] || []).push(acc[key][f]);
    for (const f of new Set(ev.map((e) => e[3]))) cnt[f] = (cnt[f] || 0) + 1;
  }
  console.log(`\n${Y} (${lists.join('+')}, ${NW ? 'combo4' : 'combo4 + фитили'}): выигрыш сделок против «держать резерв», доля капитала на начало года; среднее / медиана по монетам с такими сделками`);
  console.log('семья'.padEnd(16) + 'монет'.padStart(6) + ' | до конца года      | через 365 дн        | до конца след. года');
  for (const f of Object.keys(cnt).sort((x, y) => mean(H.ye[x] || []) - mean(H.ye[y] || []))) {
    const s = (k) => `${(mean(H[k][f] || []) * 100).toFixed(0).padStart(6)}% / ${(med(H[k][f] || []) * 100).toFixed(0).padStart(5)}%`;
    console.log(`${f.padEnd(16)}${String(cnt[f]).padStart(6)} | ${s('ye')} | ${s('y1')} | ${s('ny')}`);
  }
}
