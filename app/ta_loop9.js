/* Агент ТА, круг 9: доводка единственного информативного признака — сжатия волатильности BTC для продаж на страхе (круг 4).
   Гипотеза (заранее): провал строгой у «страх ×1,25 при сжатии» (HYPE, TON, ARIA — молодые монеты, 2025–26) — от величины доли; меньший
   множитель (×1,1) или сжатие в нисходящем тренде (BTC ниже 20-нед. средней: сжатие перед пробоем вниз, классика ТА) сохранит выигрыш и пройдёт
   строгую. Сетка (заранее, 12 клеток): ×1,1/×1,25 × bbwp < 0,3/0,4 × тренд {любой, BTC < 20-нед. средней, BTC > 20-нед. средней}.
   Критерий: строгая ✔, доход > +0,03, соседние клетки > 0, 100 новых не хуже по монетам/половинам в плюсе. Запуск: node app/ta_loop9.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), why: T.K.why(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
const scaleF = (S, conds, k) => T.pre(S, T.isFearSell, conds, (r) => Math.max(-1, +(r.act * k).toFixed(6)));
for (const k of [1.1, 1.25]) for (const x of [0.3, 0.4]) for (const [tr, cs] of [['любой тренд', []], ['BTC < 20-нед. средней', [c('b_w20', '<', 1)]], ['BTC > 20-нед. средней', [c('b_w20', '>', 1)]]])
  run(`страх ×${k} при сжатии BTC (bbwp < ${x}), ${tr}`, scaleF(T.BASE, [c('b_bbwp', '<', x), ...cs], k));
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
