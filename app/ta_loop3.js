/* Агент ТА, круг 3: размер панической покупки по положению BTC относительно 20-недельной средней (ограничение размера, вариант (б)).
   Гипотеза (заранее, из разбора круга 1): паника, когда BTC глубоко под своей 20-недельной средней (b_w20 < 0,88), покупает ближе к дну
   (19% над будущим минимумом, через 180 дн +37%), а паника при BTC около/выше средней (> 0,95) — дальше (37%, −9%), в обеих половинах истории.
   Значит доли паники ×k при b_w20 < x (крупнее глубоко внизу) и/или ×m при b_w20 > y (мельче у средней) дадут доход. Признак рыночный
   (BTC), поэтому не страдает от эффекта «купить меньше сегодня = больше завтра», как признаки монеты (агенты 3, 4C).
   Сравнение: 50-нед. средняя, 4-нед. структура BTC без нового максимума (HH28 = 0), недельный RSI BTC < 40.
   Критерий: общий (строгая ✔, доход > +0,03, соседние пороги и множители > 0, 100 новых не хуже по монетам/половинам).
   Запуск: node app/ta_loop3.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
T.addB(G, 'bhh28', (cl, h) => { const m = T.rollMax(h, 28); return cl.map((x, i) => (i >= 56 && m[i] > m[i - 28] ? 1 : 0)); });
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
// доли паники (все правила паники, включая копии C6) ×k при условии
const scaleP = (S, conds, k) => T.pre(S, T.isPanic, conds, (r) => 1 + Math.min(1, (r.act - 1) * k));
for (const x of [0.8, 0.85, 0.9, 0.95]) for (const k of [1.5, 2]) run(`паника ×${k} при BTC < ${x} × 20-нед. средней`, scaleP(T.BASE, [c('b_w20', '<', x)], k));
for (const y of [0.95, 1, 1.05]) for (const m of [0.5, 0.75]) run(`паника ×${m} при BTC > ${y} × 20-нед. средней`, scaleP(T.BASE, [c('b_w20', '>', y)], m));
for (const x of [0.85, 0.9]) run(`паника ×1,5 при b_w20 < ${x} и ×0,75 при > 1`, scaleP(scaleP(T.BASE, [c('b_w20', '<', x)], 1.5), [c('b_w20', '>', 1)], 0.75));
for (const x of [0.8, 0.9, 1]) run(`паника ×1,5 при BTC < ${x} × 50-нед. средней`, scaleP(T.BASE, [c('b_w50', '<', x)], 1.5));
run('паника ×1,5 без нового 4-нед. максимума BTC (HH28 = 0)', scaleP(T.BASE, [c('bhh28', '<', 0.5)], 1.5));
run('паника ×0,75 при новом 4-нед. максимуме BTC (HH28 = 1)', scaleP(T.BASE, [c('bhh28', '>', 0.5)], 0.75));
for (const x of [35, 40, 45]) run(`паника ×1,5 при недельном RSI BTC < ${x}`, scaleP(T.BASE, [c('b_wrsi', '<', x)], 1.5));
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
