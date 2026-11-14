/* Агент 2, круг 5: широкая тихая вершина — как пройти строгую проверку и что добавить.
   В круге 4 найдено ровное плато: «BTC в 10–25% от максимума и доля альтов за 90 дней выросла на 0,5–1 п.п.» → продать 40% даёт
   +0,27…+0,43 к доходу, лучше на 61 из 100 новых монет (хуже на 6), но строгую проверку не проходит на волосок (TON 1-я половина −7 → −8%,
   VCNT +1% → −0%, одна половина на 50 случайных).
   H5a: двухступенчатая тихая вершина: узкая (как сейчас, BTC < 10% и альты > 1,5) → 40%, широкая → 15/20/25/30%.
   H5b: широкая с меньшей долей 25/30/35%.
   H5c: широкая + «первый страх у максимума крупнее» (круг 4, H4c: страх при BTC в 20–30% от максимума → 30%).
   H5d: широкая + крупнее на жадности (тихая вершина и жадность > 70/75 → 60%).
   Запуск: node app/agent2_loop5.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iQT = M.findIndex((r) => A.has(r, 'qt')), QT = M[iQT], iWeak = M.findIndex((r) => r.act === -0.3);
const W = (b, o) => [c('btcath', '<', b), c('oth90', '>', o)];
// собрать: qt-правила вместо тихой вершины + доп. правила перед продажами на страхе
function build(qtRules, fearRules = []) { const R = [...M.slice(0, iQT), ...qtRules, ...M.slice(iQT + 1)]; const j = R.findIndex((r) => r.act === -0.3); return { ...A.MAIN, rules: [...R.slice(0, j), ...fearRules, ...R.slice(j)] }; }
const rows = [];
const run = (tag, X) => { const r = A.ev(G, X); r.tag = tag; r.S = X; r.dd = A.d(r, base); rows.push(r); console.log(A.show(tag, r, base)); return r; };
console.log(A.HDR); console.log(A.show('основа', base, base));
console.log('\nH5a: узкая 40% + широкая');
for (const [b, o] of [[15, 1], [15, 0.75], [20, 0.75], [12, 0.75], [15, 0.5]]) for (const f of [0.15, 0.2, 0.25, 0.3]) run(`узкая 40% + широкая (BTC < ${b}%, альты > ${o}) ${f * 100}%`, build([QT, { act: -f, conds: W(b, o) }]));
console.log('\nH5b: только широкая, меньшая доля');
for (const [b, o] of [[15, 1], [15, 0.75], [20, 0.75], [20, 1]]) for (const f of [0.25, 0.3, 0.35]) run(`широкая (BTC < ${b}%, альты > ${o}) ${f * 100}%`, build([{ act: -f, conds: W(b, o) }]));
console.log('\nH5c: широкая 40% + страх у максимума 30%');
for (const [b, o] of [[15, 1], [15, 0.75]]) for (const fb of [20, 25, 30]) for (const ff of [0.3, 0.4]) run(`широкая (BTC < ${b}%, альты > ${o}) 40% + страх при BTC < ${fb}% от максимума → ${ff * 100}%`, build([{ act: -0.4, conds: W(b, o) }], [{ act: -ff, conds: [c('fng', '<', 52), c('usdtd', '<', 7.6), c('btcath', '<', fb)] }]));
console.log('\nH5d: широкая 40% + на жадности крупнее');
for (const [b, o] of [[15, 1], [15, 0.75]]) for (const g of [70, 75]) for (const f of [0.5, 0.6]) run(`широкая (BTC < ${b}%, альты > ${o}): жадность > ${g} → ${f * 100}%, иначе 40%`, build([{ act: -f, conds: [...W(b, o), c('fng', '>', g)] }, { act: -0.4, conds: W(b, o) }]));
console.log('\nлучшие 12:'); for (const r of [...rows].sort((a, b) => b.dd - a.dd).slice(0, 12)) console.log(A.show(r.tag, r, base));
console.log('\nпрошли строгую проверку (по доходу):'); for (const r of rows.filter((r) => A.passes(r, base)).sort((a, b) => b.dd - a.dd)) console.log(A.show(r.tag, r, base));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop5.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: r.S, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
