/* Агент 4B, круг 5: форма возврата в рынок после тихой вершины — плато и защита половины экзамена (XMR 2025–26).
   Гипотеза: возврат по новому 90-дн. максимуму монеты после тихой вершины — устойчивое улучшение, если: (а) плато по размеру широкой
   (35/40/50%), размеру возврата (5/10/15%) и окну (20/30/45/60 дней) ровное; (б) одна из форм проходит строгую проверку:
   «каждый день маркера» / «только первый день нового максимума» / «и BTC в 20% от максимума» (возврат только в бычьем рынке).
   Критерий: строгая ✔, доход > +0,03, соседи в плюсе, вершины не хуже. Запуск: node app/agent4b_loop5.js (≈4 мин) */
const B = require('./agent4b_sim.js');
const { c } = B;
const G = B.groups(), base = B.ev(G, B.W25);
const I = (X) => X.ind;
B.addInd(G, 'ago_qt', (X) => B.since(X.n, (i) => I(X).qt[i] > 0.5 || (I(X).btcath[i] < 15 && I(X).oth90[i] > 1)));
B.addInd(G, 'hi90f', (X) => { const a = new Float64Array(X.n), h = I(X).hi90; for (let i = 1; i < X.n; i++) a[i] = h[i] > 0.5 && !(h[i - 1] > 0.5) ? 1 : 0; return a; });
const rows = []; const run = (tag, S) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, base); rows.push(r); console.log(B.show(tag, r, base) + (B.passes(r, base) ? '' : ' | ' + B.why(r, base))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base));
const R = B.W25.rules, iW = R.findIndex(B.isW);
const withWide = (s) => ({ ...B.W25, rules: R.map((r, i) => (i === iW ? { ...r, act: -s } : r)) });
const FORMS = { все: [c('hi90', '>', 0.5)], первый: [c('hi90f', '>', 0.5)], 'BTC<20': [c('hi90', '>', 0.5), c('btcath', '<', 20)] };
for (const f in FORMS) for (const s of [0.35, 0.4, 0.5]) for (const r of [0.05, 0.1, 0.15]) for (const D of [20, 30, 45, 60]) {
  const cond = [c('ago_qt', '<', D + 0.5), c('ago_qt', '>', 0.5), c('fng', '>', 52), ...FORMS[f]];
  run(`[${f}] широкая ${s * 100}% + возврат ${r * 100}% ≤ ${D} дн`, B.ins(withWide(s), [{ act: 1 + r, conds: cond }]));
}
require('fs').writeFileSync(B.SCR + '/agent4b_loop5.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: B.passes(r, base), why: B.why(r, base), m: r.m, n100: r.n100.med, bw: B.bw(r, base, 'n100') }))));
