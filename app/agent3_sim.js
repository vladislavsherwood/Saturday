/* Агент 3: помощники поверх agent2_sim.js — эталон W25 (found/agent2-best.json), признаки самой монеты (памп, просадка после пампа,
   бета/волатильность к BTC), быстрый прогон сетки вариантов и строка сравнения с W25.
   Использование: const A = require('./agent3_sim.js'); const G = A.groups(); const base = A.ev(G, A.W25); console.log(A.show(tag, A.ev(G, S), base)) */
const A2 = require('./agent2_sim.js');
const fs = require('fs');
const W25 = JSON.parse(fs.readFileSync(__dirname + '/found/agent2-best.json', 'utf8'));
const { c } = A2;
// дополнительные индикаторы монеты (только прошлое). Регистрируются в A2.EXTRA, считаются при загрузке групп.
const COINX = [];
function rollMax(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] <= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
function rollMin(a, w) { const n = a.length, o = new Float64Array(n); const dq = []; for (let i = 0; i < n; i++) { while (dq.length && a[dq[dq.length - 1]] >= a[i]) dq.pop(); dq.push(i); while (dq[0] <= i - w) dq.shift(); o[i] = a[dq[0]]; } return o; }
function coinFeatures(X) {
  if (X.ind.pump365) return;
  const n = X.n, c = X.c, I = X.ind;
  // памп: во сколько раз максимум за W дней выше минимума за W дней ДО этого максимума (приближение: max(W)/min(2W)), и просадка от максимума
  for (const w of [90, 180, 365]) {
    const mx = rollMax(c, w), mn = rollMin(c, w), o = new Float64Array(n), dd = new Float64Array(n);
    for (let i = 0; i < n; i++) { o[i] = mx[i] / mn[i]; dd[i] = (1 - c[i] / mx[i]) * 100; }
    I['pump' + w] = o; I['ddm' + w] = dd;
  }
  // бета и волатильность к BTC за 90/180 дней (дневные лог-доходности)
  const b = I.btcp;
  if (b) for (const w of [90, 180]) {
    const beta = new Float64Array(n), vol = new Float64Array(n), corr = new Float64Array(n);
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, k = 0; const q = [];
    for (let i = 0; i < n; i++) {
      let x = NaN, y = NaN;
      if (i > 0 && b[i] > 0 && b[i - 1] > 0 && c[i] > 0 && c[i - 1] > 0) { x = Math.log(b[i] / b[i - 1]); y = Math.log(c[i] / c[i - 1]); }
      q.push([x, y]); if (!isNaN(x)) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; k++; }
      if (q.length > w) { const [x0, y0] = q.shift(); if (!isNaN(x0)) { sx -= x0; sy -= y0; sxx -= x0 * x0; syy -= y0 * y0; sxy -= x0 * y0; k--; } }
      if (k >= w * 0.8) { const vx = sxx / k - (sx / k) ** 2, vy = syy / k - (sy / k) ** 2, cv = sxy / k - (sx / k) * (sy / k); beta[i] = cv / vx; vol[i] = Math.sqrt(Math.max(vy, 0) * 365) * 100; corr[i] = cv / Math.sqrt(vx * vy); }
      else { beta[i] = NaN; vol[i] = NaN; corr[i] = NaN; }
    }
    I['beta' + w] = beta; I['vol' + w] = vol; I['corr' + w] = corr;
  }
  for (const f of COINX) f(X);
}
A2.EXTRA.push(coinFeatures);
const groups = (list) => A2.groups(list);
const ev = (G, S, withM = true) => A2.ev(G, S, withM);
// сравнение с эталоном: сколько монет лучше/хуже
const bw = (r, b, g) => [r[g].e.filter((v, i) => v > b[g].e[i] + 0.5).length, r[g].e.filter((v, i) => v < b[g].e[i] - 0.5).length];
function show(tag, r, b) {
  const s = A2.show(tag, r, b);
  return s;
}
const withRules = (S, f) => A2.mapRules(S, f);
// новый индикатор на всех монетах всех групп: fn(X) → Float64Array
function addInd(G, key, fn) { for (const g in G) for (const X of G[g]) if (!X.ind[key]) X.ind[key] = fn(X); }
// защита резерва: в дни, когда flag > 0.5, правила покупки (act > 1) не тратят резерв.
// mode 'dca' — в такой день только взнос (перед правилом покупки вставляется копия с act 1); 'skip' — правило покупки не срабатывает (день уходит дальше по списку, например в продажу на страхе)
function guard(S, flag, mode = 'dca', which = (r) => r.act > 1) {
  return { ...S, rules: S.rules.flatMap((r) => (!which(r) ? [r] : mode === 'dca' ? [{ ...r, act: 1, conds: [...r.conds, c(flag, '>', 0.5)] }, r] : [{ ...r, conds: [...r.conds, c(flag, '<', 0.5)] }])) };
}
// размеры по признаку: в дни flag > 0.5 доля покупки резерва (act − 1) умножается на kb (не больше всего резерва), доля продажи — на ks
function scale(S, flag, kb = 1, ks = 1, which = () => true) {
  return { ...S, rules: S.rules.flatMap((r) => {
    if (!which(r)) return [r];
    if (r.act > 1 && kb !== 1) return [{ ...r, act: 1 + Math.min(1, (r.act - 1) * kb), conds: [...r.conds, c(flag, '>', 0.5)] }, r];
    if (r.act < 0 && ks !== 1) return [{ ...r, act: Math.max(-1, r.act * ks), conds: [...r.conds, c(flag, '>', 0.5)] }, r];
    return [r];
  }) };
}
// то же, но условия признака добавляются прямо в правила (для сохранения в JSON без служебных флагов)
function scaleC(S, conds, kb = 1, ks = 1, which = () => true) {
  return { ...S, rules: S.rules.flatMap((r) => {
    if (!which(r)) return [r];
    if (r.act > 1 && kb !== 1) return [{ ...r, act: 1 + Math.min(1, (r.act - 1) * kb), conds: [...r.conds, ...conds] }, r];
    if (r.act < 0 && ks !== 1) return [{ ...r, act: Math.max(-1, r.act * ks), conds: [...r.conds, ...conds] }, r];
    return [r];
  }) };
}
const flagOf = (n, f) => { const a = new Float64Array(n); for (let i = 0; i < n; i++) a[i] = f(i) ? 1 : 0; return a; };
// ряд роста: c / минимум за w дней до этого дня; максимум такого роста за W дней (был ли памп в ×N)
function runup(X, w, W) { const mn = rollMin(X.c, w), r = new Float64Array(X.n); for (let i = 0; i < X.n; i++) r[i] = X.c[i] / mn[i]; return rollMax(r, W); }
// сравнение с эталоном одной строкой + сколько монет 100 новых лучше/хуже
function row(tag, r, b) { const n = r.n100 && b.n100 ? ` | 100н лучше/хуже ${bw(r, b, 'n100').join('/')}` : ''; return A2.show(tag, r, b) + n; }
const addRule = (S, rule, pos = 'end') => { const R = [...S.rules]; if (pos === 'end') R.push(rule); else R.splice(pos, 0, rule); return { ...S, rules: R }; };
// добавить условие ко всем правилам, где f(r, i) истинно
const addCond = (S, f, conds) => ({ ...S, rules: S.rules.map((r, i) => (f(r, i) ? { ...r, conds: [...r.conds, ...conds] } : r)) });
module.exports = { ...A2, A2, W25, groups, ev, show, bw, withRules, addRule, addCond, COINX, rollMax, rollMin, c, addInd, guard, flagOf, runup, row, scale, scaleC };
