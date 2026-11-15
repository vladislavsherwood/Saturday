/* Фильтры против ранних покупок «паники в стейблах» поверх combo3 без tune1.
   К правилам паники (usdt > 1,07, доля > взноса) добавляю условие перепроданности; не прошло — день уходит ниже по списку (обычно взнос).
   Запуск: node panic_test.js [n100] */
const Z = require('./combo2_sim.js'), C3 = require('./combo3_sim.js');
const N100 = process.argv[2] === 'n100';
const G = Z.load(['sel', 'ex', 'rnd', 'n100']);
const base = C3.make({ simp: 1, t2: 1, t3: 1 });
const isP = (r) => r.act > 1.0001 && r.conds.some((c) => c.ind === 'usdt');
function V(conds, only) {
  const S = C3.clone(base);
  for (const r of S.rules) if (isP(r) && (!only || only(r))) r.conds.push(...conds.map(([ind, op, v]) => ({ ind, op, v })));
  return S;
}
const conf = (r) => r.conds.some((c) => c.ind === 'oidd30'); // подтверждённая паника (вынос OI)
// мягкий вариант: доля паники полная, если выполнен любой из наборов условий alts (ИЛИ); иначе доля × k (0 — только взнос, правило уходит ниже)
function Soft(alts, k) {
  const S = C3.clone(base), out = [], mk = (cs) => cs.map(([ind, op, v]) => ({ ind, op, v }));
  for (const r of S.rules) {
    if (!isP(r)) { out.push(r); continue; }
    for (const cs of alts) out.push({ act: r.act, conds: [...r.conds, ...mk(cs)] });
    if (k > 0) out.push({ act: +(1 + (r.act - 1) * k).toFixed(6), conds: r.conds });
  }
  S.rules = out; return S;
}
const NA = ['isalt', '<', 0.5];
// доля отдельного правила паники: ключ — act правила в основе
function Act(from, to) { const S = C3.clone(base); for (const r of S.rules) if (isP(r) && Math.abs(r.act - from) < 1e-9) r.act = to; return S; }
const VARS = [
  ['25% → 15%', Act(1.25, 1.15)], ['25% → 20%', Act(1.25, 1.2)], ['25% → 30%', Act(1.25, 1.3)],
  ['10% страх → 5%', Act(1.1, 1.05)], ['10% → 15%', Act(1.1, 1.15)],
  ['50% → 35%', Act(1.5, 1.35)], ['62.5% → 45%', Act(1.625, 1.45)],
];



const lists = N100 ? ['sel', 'ex', 'rnd', 'n100'] : ['sel', 'ex', 'rnd'];
const B = Z.evc(G, base, lists), BS = Z.sum(B);
const f = (s) => `${Math.round(s.med)}/${s.pos}/${s.hpos}`;
console.log('база', lists.map((g) => g + ' ' + f(BS[g].all)).join(' | '));
for (const [nm, S] of VARS) {
  const R = Z.evc(G, S, lists), RS = Z.sum(R);
  const segs = Z.SEGS.map((s) => `${s} ${(Z.inc(RS, s) - Z.inc(BS, s)).toFixed(3)}${Z.strict(RS, BS, s).length ? '✗' : '✔'}`).join(' ');
  let n = ''; if (N100) { const m = Z.mlog(R, B, 'all', ['n100']); n = ` | 100н ${f(RS.n100.all)} лог ${m.m.toFixed(3)} лучше/хуже ${m.u}/${m.d}`; }
  console.log(nm.padEnd(20), lists.filter((g) => g !== 'n100').map((g) => f(RS[g].all)).join(' | '), '|', segs, n, Z.strict(RS, BS, 'all').join(','));
}
