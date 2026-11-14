/* Круг 6. Плато признака поведения (corr180 × vol180) и размеров (тихие × страх); «список ИЛИ поведение» */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const FEAR = [14, 15, 16, 17], QT = [21, 22, 23, 24];
// conds — список наборов условий (ИЛИ): для каждого набора своя копия перед исходным правилом
function both(kq, kf, sets) {
  return { ...S, rules: S.rules.flatMap((r, q) => { const k = QT.includes(q) ? kq : FEAR.includes(q) ? kf : 1; return k === 1 ? [r] : [...sets.map((cs) => ({ act: Math.max(-1, r.act * k), conds: [...r.conds, ...cs] })), r]; }) };
}
const beh = (cr, v) => [c('corr180', '>', cr), c('vol180', '<', v)];
const V = [];
for (const cr of [0.6, 0.65, 0.7, 0.75]) for (const v of [80, 90, 100]) V.push([`corr>${cr} vol<${v}: тихие ×1,5 страх ×1,25`, both(1.5, 1.25, [beh(cr, v)])]);
for (const kq of [1.25, 1.5, 2]) for (const kf of [1, 1.25, 1.5]) V.push([`corr>0,65 vol<90: тихие ×${kq} страх ×${kf}`, both(kq, kf, [beh(0.65, 90)])]);
V.push(['список ИЛИ corr>0,65 vol<90: тихие ×1,5 страх ×1,25', both(1.5, 1.25, [[c('isbig', '>', 0.5)], beh(0.65, 90)])]);
V.push(['список ИЛИ corr>0,7 vol<90: тихие ×1,5 страх ×1,25', both(1.5, 1.25, [[c('isbig', '>', 0.5)], beh(0.7, 90)])]);
console.log('вариант | доход все, строгая | крупные Σлог вся/пол/годы (лучше/хуже)/старт, монет л/х | лучше/хуже отбор, экз, 50сл | медианы');
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); const bw = (g) => K.bw(o.r, rb, g).join('/');
  console.log(`${t} | ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)} ${o.pass.slice(0, 60)} | ${o.s.full.toFixed(2)}/${o.s.h.toFixed(2)}/${o.s.yrs.toFixed(2)} (${o.s.better}/${o.s.worse})/${o.s.st.toFixed(1)}, ${o.s.coinsBW.join('/')} | ${bw('sel')}, ${bw('ex')}, ${bw('rnd')} | ${o.r.sel.med.toFixed(0)}/${o.r.ex.med.toFixed(0)}/${o.r.rnd.med.toFixed(0)} худш.пол ${o.r.sel.hworst.toFixed(1)}/${o.r.ex.hworst.toFixed(1)}/${o.r.rnd.hworst.toFixed(1)}`); }
