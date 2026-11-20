/* hv, круг 3: продажи на страхе (правила 12–27) у волатильной монеты — в начале её спада крупнее, в середине/конце спада — меньше.
   Копия каждого правила страха перед ним: + hvv > T, не крупная (isbig < 0,5), [+ просадка монеты от 90-дн. максимума ddm90 < D или > D2], доля × m. */
const H = require('./hv_lib.js'), { c } = H;
const FEAR = (r, k) => k >= 11 && k <= 26, STRONG = (r, k) => k >= 11 && k <= 18, WEAK = (r, k) => k >= 19 && k <= 26;
const NB = [c('isbig', '<', 0.5)];
const mod = (T, m, ex = []) => (r) => { r.conds.push(...H.HV(T), ...NB, ...ex); r.act = H.mul(m)(r.act); return r; };
H.head();
H.ev('combo5', H.S5);
for (const m of [1.25, 1.5, 2]) H.ev(`T115 весь страх ×${m}`, H.preMod(H.S5, FEAR, mod(115, m)));
for (const m of [1.5]) { H.ev(`T115 сильный страх ×${m}`, H.preMod(H.S5, STRONG, mod(115, m))); H.ev(`T115 страх<52 ×${m}`, H.preMod(H.S5, WEAK, mod(115, m))); }
for (const D of [20, 30, 40]) for (const m of [1.5, 2]) H.ev(`T115 начало спада ddm90<${D} ×${m}`, H.preMod(H.S5, FEAR, mod(115, m, [c('ddm90', '<', D)])));
for (const D of [50, 60, 70]) for (const m of [0.5, 0]) H.ev(`T115 глубоко ddm90>${D} ×${m}`, H.preMod(H.S5, FEAR, m === 0 ? (r) => mod(115, 1, [c('ddm90', '>', D)])({ ...r, act: 1 }) : mod(115, m, [c('ddm90', '>', D)])));
for (const T of [100, 130]) for (const m of [1.5]) H.ev(`T${T} весь страх ×${m}`, H.preMod(H.S5, FEAR, mod(T, m)));
// сочетание: начало спада ×1,5 (ddm90 < 30) и глубоко ×0,5 (ddm90 > 60)
{ let S = H.preMod(H.S5, FEAR, mod(115, 1.5, [c('ddm90', '<', 30)])); S = H.preMod(S, (r) => r.act < 0 && r.conds.some((x) => x.ind === 'fng' && x.op === '<' && (x.v === 40 || x.v === 52)) && !r.conds.some((x) => x.ind === 'hvv'), mod(115, 0.5, [c('ddm90', '>', 60)])); H.ev('T115 ddm90<30 ×1,5 и ddm90>60 ×0,5', S); }
