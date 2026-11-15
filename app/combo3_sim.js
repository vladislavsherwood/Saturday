/* combo3: итоговая сборка по решениям пользователя поверх combo2-best (found/combo2-best.json, 59 правил).
   Правки (каждую можно включить отдельно, чтобы видеть вклад и пересечения):
   - simp — упрощение imp8 (imp8_sim.simplifyC): убрать мёртвые копии «паника + страх < 52 + доля USDT < 7,6» (#7–9 combo2) и
     «разворот + фандинг → весь резерв» (#11 combo2, исключение tune5), охрану (разворот на страхе → только взнос) поставить за последнее правило паники
     без страха, убрать мёртвые условия (страх < 52 при страхе < 40, ago_qt > 0,5 у возврата, доля USDT у охраны). Неподтверждённая паника 10% (#5) остаётся.
   - t2 — tune2: множитель сильной паники (usdt > 1,2) ×1,5 → ×2,5: доли с выносом OI 25/50/50% × 2,5 → 62,5 / 100 / 100% (не больше всего резерва).
   - t3 — tune3: «ведёт себя как крупная» corr180 > 0,65 → 0,60.
   - t1 — tune1-кандидат: сразу за «волной ликвидаций» (oidd30 < −28 → 50%) — «oidd30 < −26 → 15% резерва».
   Использование: const C3 = require('./combo3_sim.js'); const S = C3.make({ simp: 1, t1: 1, t2: 1, t3: 1 }); */
const fs = require('fs');
const I8 = require('./imp8_sim.js');
const C2J = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8'));
const C2 = { base: C2J.base, rules: C2J.rules };
const clone = (S) => JSON.parse(JSON.stringify(S));
const usdtN = (r) => r.conds.filter((x) => x.ind === 'usdt').length;
// tune2: копии C6 (два условия usdt) — доля (act − 1) была ×1,5 к обычной; делаю ×m (по умолчанию 2,5), не больше всего резерва
function t2(S, m = 2.5) {
  const o = clone(S);
  for (const r of o.rules) if (r.act > 1 && usdtN(r) === 2) r.act = +(1 + Math.min(1, ((r.act - 1) / 1.5) * m)).toFixed(6);
  return o;
}
// tune3: порог корреляции «ведёт себя как крупная»
function t3(S, v = 0.6) {
  const o = clone(S);
  for (const r of o.rules) for (const x of r.conds) if (x.ind === 'corr180' && x.op === '>') x.v = v;
  return o;
}
// tune1: лесенка за волной ликвидаций
function t1(S, thr = -26, share = 0.15) {
  const o = clone(S);
  const i = o.rules.findIndex((r) => r.conds.length === 1 && r.conds[0].ind === 'oidd30' && r.conds[0].op === '<' && r.act > 1);
  o.rules.splice(i + 1, 0, { act: 1 + share, conds: [{ ind: 'oidd30', op: '<', v: thr }] });
  return o;
}
const simp = (S) => I8.simplifyC(clone(S));
// порядок применения: правки по смыслу правил не зависят от порядка; упрощение — последним (оно ищет правила по условиям)
function make(o = {}) {
  let S = clone(C2);
  if (o.t2) S = t2(S, o.m || 2.5);
  if (o.t3) S = t3(S, o.corr || 0.6);
  if (o.t1) S = t1(S, o.thr || -26, o.share || 0.15);
  if (o.simp) S = simp(S);
  if (o.yld) S.yld = o.yld;
  return S;
}
module.exports = { C2, C2J, t1, t2, t3, simp, make, clone };
