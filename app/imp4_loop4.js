/* imp4, круг 4. Что делать в первый день обвала: ничего / докупить / продать.
   (1) По событиям: 22 обвала круга 1, 180 монет; доходность монеты от закрытия D (и D+1 — так исполняет стенд: решение по вчерашнему дню)
       до D+7/+30/+90 против любого дня; где был минимум следующих 30 дней; что основа делала в D+1…D+7.
   (2) В стенде: признак crash (вчера рынок альтов ≤ −13% или BTC ≤ −12%) → купить y% резерва / продать x%; место правила: первым (вместо
       любого правила дня) или после покупок (вместо продажи на страхе). Отдельно — обвал самой монеты (≤ −20% за день, рынок спокоен).
   Запуск: node app/imp4_loop4.js <out.json> */
const L = require('./imp4_lib.js'); const { K } = L; const c = K.c;
const fs = require('fs');
const G = K.groups(['sel', 'ex', 'rnd', 'n100']); K.prep(G);
const { M } = L.market(G);
const T0 = L.tOf('2018-06-01');
const crashDay = new Set([...M].filter(([t, v]) => t >= T0 && (v.alt <= -0.13 || v.btc <= -0.12)).map(([t]) => t));
const eps = []; for (const t of [...crashDay].sort((a, b) => a - b)) { if (eps.length && t - eps[eps.length - 1].last < 14) eps[eps.length - 1].last = t; else eps.push({ t, last: t }); }
const first = new Set(eps.map((e) => e.t));
const coins = Object.values(G).flat().filter((X) => !/USD|CHF|DAI/.test(X.name));
// (1) событийно
const fw = (X, i, k) => (i + k < X.n ? X.c[i + k] / X.c[i] - 1 : NaN);
const rowsE = [];
for (const e of eps) {
  const v = { d: L.day(e.t), r: { 0: [], 1: [] }, mn: [], mnDay: [] };
  for (const X of coins) { const i = e.t - X.t[0]; if (i < 30 || i + 91 >= X.n || X.t[i] !== e.t) continue;
    for (const s of [0, 1]) v.r[s].push([7, 30, 90].map((k) => fw(X, i + s, k)));
    let m = Infinity, md = 0; for (let k = 0; k <= 30; k++) if (X.c[i + k] < m) { m = X.c[i + k]; md = k; } v.mn.push(m / X.c[i] - 1); v.mnDay.push(md); }
  if (v.r[0].length < 8) continue;
  const med = (s, q) => K.med(v.r[s].map((x) => x[q])) * 100;
  rowsE.push({ d: v.d, n: v.r[0].length, D: [0, 1, 2].map((q) => med(0, q)), D1: [0, 1, 2].map((q) => med(1, q)), mn: K.med(v.mn) * 100, mnDay: K.med(v.mnDay) });
}
// база: любой день с 2018-06 (по монетам, медиана)
const base = [7, 30, 90].map((k) => { const v = []; for (const X of coins) for (let i = Math.max(0, T0 - X.t[0]); i + k < X.n; i += 3) v.push(fw(X, i, k)); return K.med(v) * 100; });
console.log('эпизод | монет | от закрытия D: +7/+30/+90 дн | от закрытия D+1 | минимум 30 дн от D (на какой день)');
for (const r of rowsE) console.log(`${r.d} | ${r.n} | ${r.D.map((x) => x.toFixed(0)).join('/')}% | ${r.D1.map((x) => x.toFixed(0)).join('/')}% | ${r.mn.toFixed(0)}% (${r.mnDay})`);
const mm = (f) => K.med(rowsE.map(f));
console.log(`МЕДИАНА эпизодов | — | ${[0, 1, 2].map((q) => mm((r) => r.D[q]).toFixed(1)).join('/')}% | ${[0, 1, 2].map((q) => mm((r) => r.D1[q]).toFixed(1)).join('/')}% | ${mm((r) => r.mn).toFixed(0)}% (${mm((r) => r.mnDay)})`);
console.log(`в плюсе (эпизодов из ${rowsE.length}) от D: ${[0, 1, 2].map((q) => rowsE.filter((r) => r.D[q] > 0).length).join('/')}, от D+1: ${[0, 1, 2].map((q) => rowsE.filter((r) => r.D1[q] > 0).length).join('/')}`);
console.log(`любой день (база): +7/+30/+90 ${base.map((x) => x.toFixed(1)).join('/')}%`);
// (2) стенд
const at = (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = crashDay.has(X.t[i]) ? 1 : 0; return a; };
const atF = (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = first.has(X.t[i]) ? 1 : 0; return a; };
const own = (X) => { const a = new Float64Array(X.n); for (let i = 1; i < X.n; i++) { const m = M.get(X.t[i]); a[i] = X.c[i] / X.c[i - 1] - 1 <= -0.2 && !crashDay.has(X.t[i]) && !(m && m.alt < -0.07) ? 1 : 0; } return a; };
for (const g in G) for (const X of G[g]) { X.ind.crash = at(X); X.ind.crash1 = atF(X); X.ind.owncr = own(X); }
const S0 = L.S0, iSell = S0.rules.findIndex((r) => r.act < 0);
const put = (pos, r) => ({ ...S0, rules: [...S0.rules.slice(0, pos), r, ...S0.rules.slice(pos)] });
const V = [];
for (const key of ['crash', 'crash1']) for (const a of [1, 1.1, 1.25, 1.5, 2]) for (const [pn, pos] of [['первым', 0], ['после покупок', iSell]]) V.push([`${key === 'crash' ? 'любой день обвала' : 'первый день эпизода'}: ${a === 1 ? 'ничего (только взнос)' : 'купить ' + Math.round((a - 1) * 100) + '% резерва'} — ${pn}`, put(pos, { act: a, conds: [c(key, '>', 0.5)] })]);
for (const key of ['crash', 'crash1']) for (const x of [0.1, 0.25]) V.push([`${key === 'crash' ? 'любой день обвала' : 'первый день эпизода'}: продать ${x * 100}% — первым`, put(0, { act: -x, conds: [c(key, '>', 0.5)] })]);
for (const a of [1, 1.25, 1.5]) V.push([`обвал самой монеты ≤ −20% (рынок спокоен): ${a === 1 ? 'ничего' : 'купить ' + Math.round((a - 1) * 100) + '%'} — первым`, put(0, { act: a, conds: [c('owncr', '>', 0.5)] })]);
for (const x of [0.1, 0.25]) V.push([`обвал самой монеты: продать ${x * 100}% — первым`, put(0, { act: -x, conds: [c('owncr', '>', 0.5)] })]);
const b0 = K.ev(G, S0, false), R = {};
let nd = 0; for (const X of [...G.sel, ...G.ex, ...G.rnd]) for (let i = 0; i < X.n; i++) nd += X.ind.owncr[i];
console.log(`\nстенд; дней «обвал монеты» на 81 монете: ${nd}`);
for (const [t, S] of V) { const r = K.ev(G, S, false), [bt, wr] = K.bw(r, b0, 'n100'); R[t] = { d: K.d(r, b0), strict: K.passes(r, b0), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, n100: r.n100.med, pos: r.n100.pos, h: r.n100.hpos, bw: [bt, wr] };
  console.log(`${t} | ${R[t].d >= 0 ? '+' : ''}${R[t].d.toFixed(3)} ${R[t].strict ? '✔' : '· ' + K.why(r, b0)} | ${r.sel.med.toFixed(0)}/${r.ex.med.toFixed(0)}/${r.rnd.med.toFixed(0)} | 100н ${r.n100.med.toFixed(0)} ${r.n100.pos}/${r.n100.hpos} ${bt}/${wr}`); }
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify({ rowsE, base, R }, null, 1));
