/* Агент ТА, круг 7: правило C (слабая к BTC монета → продажи ×1,25) и ТА самой монеты — фильтр (а), замена условия (г), доп. условие (д).
   Гипотеза (заранее): единственный провал строгой проверки у C — ARIA 2026 (C продаёт по 0,03 при rel180 = −87% перед ростом до 0,22): это
   продажа глубоко перепроданной монеты у дна. Если C не срабатывает, когда монета далеко под своей 20-недельной средней (t_w20 < 0,5/0,6)
   или при бычьем расхождении RSI / RSI14 < 30 (признаки исчерпания падения), провал уйдёт, а выигрыш C сохранится (≥ 80%).
   Сравнение (г): условие «ниже 20-недельной средней» (t_w20 < 0,8/0,9/1) вместо rel180 < −15 — ТА-форма «слабой монеты» без BTC;
   (д): C только когда монета ещё и ниже своей 20-недельной средней. Критерий: строгая ✔ к основе, доход ≥ −0,02 (для фильтра — убрать провал,
   не потеряв выигрыш), для замены — доход > +0,03. Запуск: node app/ta_loop7.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
const isC = (r) => T.has(r, 'rel180');
const noC = { ...T.BASE, rules: T.BASE.rules.filter((r) => !isC(r)) };
run('без C (F + C6)', noC);
for (const x of [0.4, 0.5, 0.6]) run(`C только при t_w20 > ${x} (не у глубоко перепроданной)`, T.addC(T.BASE, isC, [c('t_w20', '>', x)]));
run('C только при RSI14 > 30', T.addC(T.BASE, isC, [c('t_rsi', '>', 30)]));
run('C только без бычьего расхождения', T.addC(T.BASE, isC, [c('t_dvg', '<', 0.5)]));
const repl = (conds) => ({ ...T.BASE, rules: T.BASE.rules.map((r) => (isC(r) ? { ...r, conds: [...r.conds.filter((q) => q.ind !== 'rel180'), ...conds] } : r)) });
for (const x of [0.7, 0.8, 0.9, 1]) run(`замена: C при t_w20 < ${x} вместо rel180 < −15`, repl([c('t_w20', '<', x)]));
for (const x of [0.8, 1]) run(`C при rel180 < −15 и t_w20 < ${x}`, T.addC(T.BASE, isC, [c('t_w20', '<', x)]));
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
