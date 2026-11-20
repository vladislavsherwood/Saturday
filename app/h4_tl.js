/* h4: хронология по монете — сделки (правило, сумма в % капитала, цена) и ln(капитал/DCA), кэш на конец месяца в окне дат.
   Запуск: node h4_tl.js МОНЕТА 2019-01-01 2020-06-30 [nowick] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const [nm, d0, d1, nw] = process.argv.slice(2);
const X = Object.values(G).flat().find((x) => x.name === nm);
const pol = { ...L.pol0, trace: [], ...(nw ? {} : { wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place', log: [] } }) };
const { tr } = P.edge(X, S, 0, 'full', true, pol); const T = pol.trace, c = X.c, n = X.n, I = X.ind;
const Rc = S.rules.filter((r) => r.conds.every((cd) => I[cd.ind])), oi = Rc.map((r) => S.rules.indexOf(r));
let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (10 * 0.999) / c[i]; D[i] = du * c[i]; }
const V = T.map(([i, cash, u]) => cash + u * c[i]);
const ev = [];
for (const t of tr) ev.push([t.i, `${t.s > 0 ? 'КУП' : 'ПРД'} #${oi[t.q] + 1}${t.pan ? ' пан' : ''} ${((100 * t.amt) / V[t.i - 1]).toFixed(0)}%`]);
if (pol.wick) for (const [, i, k, amt] of pol.wick.log) ev.push([i, `ФИТ −${k * 100}% ${((100 * amt) / V[i - 1]).toFixed(0)}%`]);
ev.sort((a, b) => a[0] - b[0]);
const inW = (i) => { const d = L.day(I.t[i]); return d >= d0 && d <= d1; };
for (let i = 1; i < n; i++) {
  if (!inW(i)) continue;
  const d = L.day(I.t[i]), last = i === n - 1 || L.day(I.t[i + 1]).slice(0, 7) !== d.slice(0, 7);
  for (const [k, s] of ev) if (k === i) console.log(`  ${d} ${s.padEnd(22)} цена ${c[i].toPrecision(4)} usdt ${I.usdt[i - 1].toFixed(3)} othd ${I.othd[i - 1].toFixed(1)} upk10 ${I.upk10[i - 1].toFixed(3)} pday ${I.pday[i - 1]} epn ${I.epn[i - 1]} fng ${I.fng[i - 1]} rel90 ${(I.rel90[i - 1] || 0).toFixed(0)} кэш ${((100 * T[i][1]) / V[i]).toFixed(0)}% долг ${T[i][3].toFixed(0)}`);
  if (last) console.log(`${d} ── ln(V/DCA) ${Math.log(V[i] / D[i]).toFixed(3)} кэш ${((100 * T[i][1]) / V[i]).toFixed(0)}% цена ${c[i].toPrecision(4)} BTC ${I.btcp ? I.btcp[i].toFixed(0) : ''} sma200 ${I.sma200[i].toFixed(2)} btc200 ${I.btc200[i].toFixed(2)} othd ${I.othd[i].toFixed(1)}`);
}
