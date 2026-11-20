/* h4, диагностика провальных лет (2019, 2023, 2026) на основе combo4 + фитили (и combo4 без фитилей — аргумент nowick).
   По каждой монете (сдвиг 0, вся история) и году: прирост ln(капитал/DCA), доля кэша в капитале (начало / среднее / конец), деньги:
   покупки из резерва по семьям правил (сверх взноса), выдача долга паники, фитили, продажи по семьям, дни «копить взнос» (act < 1).
   Плюс «упущено»: сколько дал бы год, если бы кэш на начало года был вложен (грубо: ln(V_full/DCA) − ln(V/DCA)).
   Запуск: node h4_diag.js [nowick] [год ...] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const args = process.argv.slice(2), NW = args.includes('nowick'), YSHOW = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const R_ = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FAM = [['кап', [1]], ['вынос', [2, 3]], ['паника', R_(4, 9)], ['охрана', [10]], ['сильстрах-', R_(11, 18)], ['страх-', R_(19, 26)], ['развBTC', [27]], ['фанд-', R_(28, 30)],
  ['тихвер-', R_(31, 50)], ['возврат', [51]], ['памп-', R_(52, 54)], ['альтсез-', [55]], ['эйф-', [56, 57]]];
const famOf = (k) => { for (const [nm, ids] of FAM) if (ids.includes(k + 1)) return nm; return '?'; };
const UNIT = 10, FEE = 0.001, YS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const sum = (v) => v.reduce((a, b) => a + b, 0);
const out = {}; // год → [{nm, g, seg, d, cs0, csm, cs1, buy{fam:$}, rel, wick, sell{fam:$}, keep, V0, pr, btc, miss}]
function coin(X, g) {
  const pol = { ...L.pol0, trace: [], ...(NW ? {} : { wick: { ...WICK, log: [] } }) };
  const { tr } = P.edge(X, S, 0, 'full', true, pol); const T = pol.trace, c = X.c, n = X.n, I = X.ind;
  const Rc = S.rules.filter((r) => r.conds.every((cd) => I[cd.ind])), oi = Rc.map((r) => S.rules.indexOf(r));
  const V = T.map(([i, cash, u]) => cash + u * c[i]);
  let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (UNIT * (1 - FEE)) / c[i]; D[i] = du * c[i]; }
  const yOf = (i) => +L.day(I.t[i]).slice(0, 4);
  const byDay = new Map(); for (const t of tr) (byDay.get(t.i) || byDay.set(t.i, []).get(t.i)).push(t);
  const wl = new Map(); if (pol.wick) for (const [, i, k, amt] of pol.wick.log) wl.set(i, (wl.get(i) || 0) + amt);
  let a = 0;
  while (a < n) {
    const y = yOf(a); let b = a; while (b + 1 < n && yOf(b + 1) === y) b++;
    if (a > 0 && b > 120) {
      const e0 = Math.log(V[a - 1] / D[a - 1]), e1 = Math.log(V[b] / D[b]);
      const rec = { nm: X.name, g, seg: X.seg, d: e1 - e0, cs0: T[a - 1][1] / V[a - 1], cs1: T[b][1] / V[b], csm: 0, buy: {}, rel: 0, wick: 0, sell: {}, keep: 0, rule: {}, V0: V[a - 1],
        pr: c[b] / c[a - 1] - 1, btc: I.btcp ? I.btcp[b] / I.btcp[a - 1] - 1 : NaN };
      // «полностью вложенный» вариант: кэш на начало года вложить в монету на 1-й день, дальше как стратегия (грубая оценка упущенного)
      const cash0 = T[a - 1][1]; rec.miss = Math.log((V[b] - cash0 + (cash0 * c[b]) / c[a - 1]) / D[b]) - e1;
      for (let i = a; i <= b; i++) {
        rec.csm += T[i][1] / V[i] / (b - a + 1);
        for (const t of byDay.get(i) || []) {
          const k = oi[t.q] ?? -1, f = k >= 0 ? famOf(k) : '?';
          if (t.s > 0) { if (t.pan && !(k >= 3 && k <= 8)) rec.rel += t.amt; else rec.buy[f] = (rec.buy[f] || 0) + t.amt; }
          else rec.sell[f] = (rec.sell[f] || 0) + t.amt;
        }
        rec.wick += wl.get(i) || 0;
        const j = i - 1; if (j >= 0) { let q = -1; for (let qq = 0; qq < Rc.length; qq++) { if (Rc[qq].conds.every((cd) => (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))) { q = qq; break; } }
          const f = q >= 0 ? famOf(oi[q]) : 'нет'; rec.rule[f] = (rec.rule[f] || 0) + 1; if (q >= 0 && Rc[q].act > 0 && Rc[q].act < 1) rec.keep++; }
      }
      (out[y] = out[y] || []).push(rec);
    }
    a = b + 1;
  }
}
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) coin(X, g);
const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(2), pc = (x) => (x * 100).toFixed(0) + '%';
console.log(`ОСНОВА: combo4 (57)${NW ? '' : ' + фитили'}; сдвиг 0; медианы по монетам (81 = отбор+экзамен+50 сл.; н100 = 100 новых)`);
console.log('год  | 81: прирост, теряли/всего | н100: прирост, теряли/всего | кэш нач/сред/кон (81) | упущено (кэш нач. в монету) | цена монеты | BTC');
for (const y of YS) {
  const A = (out[y] || []).filter((r) => r.g !== 'n100'), N = (out[y] || []).filter((r) => r.g === 'n100');
  console.log(`${y} | ${sg(med(A.map((r) => r.d)))} ${A.filter((r) => r.d < -0.02).length}/${A.length} | ${sg(med(N.map((r) => r.d)))} ${N.filter((r) => r.d < -0.02).length}/${N.length} | ${pc(med(A.map((r) => r.cs0)))}/${pc(med(A.map((r) => r.csm)))}/${pc(med(A.map((r) => r.cs1)))}`
    + ` | ${sg(med(A.map((r) => r.miss)))} | ${sg(med(A.map((r) => r.pr)))} | ${sg(med(A.map((r) => r.btc)))}`);
}
// деньги по семьям в доле капитала на начало года (сумма по монетам / сумма капитала) — 81 монета
console.log('\nДеньги за год, % капитала на начало года (сумма по 81 монете): покупки из резерва по семьям (+), выдача долга паники, фитили; продажи (−)');
for (const y of YS) {
  const A = (out[y] || []).filter((r) => r.g !== 'n100'), V0 = sum(A.map((r) => r.V0)); const agg = {}, ags = {};
  for (const r of A) { for (const k in r.buy) agg[k] = (agg[k] || 0) + r.buy[k]; for (const k in r.sell) ags[k] = (ags[k] || 0) + r.sell[k]; }
  const p = (x) => ((100 * x) / V0).toFixed(0);
  console.log(`${y}: купл. ${Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + p(v)).join(', ')}; долг ${p(sum(A.map((r) => r.rel)))}; фитили ${p(sum(A.map((r) => r.wick)))} | прод. ${Object.entries(ags).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + p(v)).join(', ')}`);
}
// дни по семьям (медиана по монетам)
console.log('\nДни года по сработавшему правилу (среднее по 81 монете)');
for (const y of YS) { const A = (out[y] || []).filter((r) => r.g !== 'n100'); const agg = {}; for (const r of A) for (const k in r.rule) agg[k] = (agg[k] || 0) + r.rule[k] / A.length;
  console.log(`${y}: ${Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', ')}; копить взнос ${(sum(A.map((r) => r.keep)) / A.length).toFixed(0)}`); }
for (const y of YSHOW) {
  console.log(`\n${y}: по монетам (все списки) — прирост, кэш нач/кон, цена, упущено, покупки/продажи % капитала нач.`);
  for (const r of (out[y] || []).sort((a, b) => a.d - b.d)) {
    const p = (x) => ((100 * x) / r.V0).toFixed(0);
    console.log(`  ${r.g.padEnd(4)} ${r.nm.padEnd(9)} ${r.seg.padEnd(4)} ${sg(r.d)} кэш ${pc(r.cs0)}→${pc(r.cs1)} цена ${sg(r.pr)} упущ ${sg(r.miss)} | +${Object.entries(r.buy).map(([k, v]) => k + ' ' + p(v)).join(' ')} долг ${p(r.rel)} фит ${p(r.wick)} | −${Object.entries(r.sell).map(([k, v]) => k + ' ' + p(v)).join(' ')}`);
  }
}
module.exports = { out };
