/* Агент 3, круг 12: фандинг САМОЙ монеты (Binance USDⓈ-M, data.binance.vision; found/agent3-coin-funding.json, 117 монет из 181 —
   у остальных фьючерса нет, признак не срабатывает). Рыночный «перегретый фандинг» стратегии — по BTC; мания отдельного альта его не видит.
   H12a: фандинг монеты за 30 дней > F (2/3/5%) → продать x% (5/10/20%); H12b: монета перегрета сильнее BTC (фандинг монеты за 30 дн
   минус фандинг BTC за 30 дн > 1/2/3 п.п.) → продать x%; H12c: толпа в шортах по монете (фандинг за 7 дней < −0,3/−0,5/−1%) → покупка
   25/50% резерва. Место правила: перед разворотом BTC или в конце. База — C4. Критерий: строгая проверка к C4 + доход > +0,03 + плато.
   Запуск: node app/agent3_loop12.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const F = JSON.parse(fs.readFileSync(__dirname + '/found/agent3-coin-funding.json', 'utf8'));
const G = A.groups();
// индикаторы: cf7, cf30 — сумма фандинга монеты за 7/30 дней, %; cfx30 = cf30 − fund30 (BTC). NaN, если у монеты нет фьючерса или дней не хватает
const roll = (a, w) => { const o = new Float64Array(a.length).fill(NaN); let s = 0, k = 0; for (let i = 0; i < a.length; i++) { if (!isNaN(a[i])) { s += a[i]; k++; } if (i >= w && !isNaN(a[i - w])) { s -= a[i - w]; k--; } o[i] = k >= w * 0.9 ? s : NaN; } return o; };
let nf = 0;
for (const g in G) for (const X of G[g]) {
  const f = new Float64Array(X.n).fill(NaN), d = F[X.name];
  if (d) { nf++; const m = new Map(d.t.map((t, i) => [t, d.f[i]])); for (let i = 0; i < X.n; i++) { const v = m.get(X.t[i]); if (v != null) f[i] = v; } }
  X.ind.cfd = f; X.ind.cf7 = roll(f, 7); X.ind.cf30 = roll(f, 30);
  const x = new Float64Array(X.n); for (let i = 0; i < X.n; i++) x[i] = X.ind.cf30[i] - X.ind.fund30[i]; X.ind.cfx30 = x;
}
console.log(`монет с фандингом: ${nf}`);
const base = A.ev(G, A.C4), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
const POS = { 'перед разворотом': (S) => S.rules.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30'), 'в конце': (S) => S.rules.length, 'первым': () => 0 };
const ins = (S, pos, rules) => { const p = POS[pos](S), R = [...S.rules]; R.splice(p, 0, ...rules); return { ...S, rules: R }; };
const rec = (t, S) => { const r = A.ev(G, S); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); };
for (const F30 of [2, 3, 5]) for (const x of [0.05, 0.1, 0.2]) for (const pos of ['перед разворотом', 'в конце']) rec(`H12a фандинг монеты 30 дн > ${F30}%: продать ${x * 100}%, ${pos}`, ins(A.C4, pos, [{ act: -x, conds: [A.c('cf30', '>', F30)] }]));
for (const dx of [1, 2, 3]) for (const x of [0.05, 0.1, 0.2]) for (const pos of ['перед разворотом', 'в конце']) rec(`H12b монета − BTC фандинг 30 дн > ${dx} п.п.: продать ${x * 100}%, ${pos}`, ins(A.C4, pos, [{ act: -x, conds: [A.c('cfx30', '>', dx)] }]));
for (const f7 of [-0.3, -0.5, -1]) for (const a of [1.25, 1.5]) for (const pos of ['первым', 'перед разворотом']) rec(`H12c фандинг монеты 7 дн < ${f7}%: купить ${(a - 1) * 100}% резерва, ${pos}`, ins(A.C4, pos, [{ act: a, conds: [A.c('cf7', '<', f7)] }]));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
