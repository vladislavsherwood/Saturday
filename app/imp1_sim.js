/* imp1: помощники агента улучшения №1 (разворот BTC). Основа — found/combo-best.json (или combo2-best.json, если есть).
   Быстрый оценщик agent_sim.js через combo_sim.js (rel180, ago_qt и др.). Использование: const K = require('./imp1_sim.js'); */
const K = require('./combo_sim.js');
const fs = require('fs');
const f2 = __dirname + '/found/combo2-best.json';
const BASEF = fs.existsSync(f2) && process.env.IMP1_BASE !== 'combo' ? f2 : __dirname + '/found/combo-best.json';
const BASE = JSON.parse(fs.readFileSync(BASEF, 'utf8'));
const S0 = { base: BASE.base, rules: BASE.rules };
// правила разворота: btcr30 > 20 (на страхе — только взнос; при фандинге — весь резерв; разворот — весь резерв)
const isRev = (r) => r.conds.some((x) => x.ind === 'btcr30');
const revIdx = (S) => S.rules.map((r, i) => (isRev(r) && r.act > 1 ? i : -1)).filter((i) => i >= 0);
// заменить каждое правило разворота-покупки на список правил f(r) (их условия добавятся к условиям разворота)
const mapRev = (S, f) => ({ ...S, rules: S.rules.flatMap((r) => (isRev(r) && r.act > 1 ? f(r) : [r])) });
module.exports = { ...K, K, BASE, BASEF, S0, isRev, revIdx, mapRev };
// bdays — дней с максимума BTC (день, когда BTC был в пределах 0,5% от исторического максимума, btcath ≤ 0,5; до данных — максимум 2013-11-29).
// Считается по ряду BTC со страницы отбора и переносится на дни монеты по дате (верно и для молодых монет). Только прошлое.
let BD = null;
function bdaysMap(G) {
  if (BD) return BD;
  const B = [].concat(...Object.values(G)).find((x) => x.name === 'BTC' && x.page === 'strategy-builder-sol') || K.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC');
  BD = new Map(); let last = 16038;
  for (let i = 0; i < B.n; i++) { if (B.ind.btcath[i] <= 0.5) last = B.t[i]; BD.set(B.t[i], B.t[i] - last); }
  return BD;
}
function prep1(G) {
  const M = bdaysMap(G);
  K.addInd(G, 'bdays', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const v = M.get(X.t[i]); a[i] = v == null ? NaN : v; } return a; });
}
module.exports.prep1 = prep1;
