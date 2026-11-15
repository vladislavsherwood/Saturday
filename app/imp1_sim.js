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
// группы: для combo2 — стенд combo2_sim.load (флаги isbig/meme/isalt, ТА по BTC), иначе combo_sim + prep
const IS2 = BASEF === f2;
function groups(list = ['sel', 'ex', 'rnd']) { if (IS2) return require('./combo2_sim.js').load(list); const G = K.groups(list); K.prep(G); return G; }
const prep = () => {};
module.exports = { ...K, K, BASE, BASEF, S0, isRev, revIdx, mapRev, groups, prep, IS2 };
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
// Эпизоды разворота по ряду BTC: начало — первый день btcr30 > thr после ≥ gap дней без него. На дни монеты (по дате):
// epd — дней с начала текущего эпизода (NaN, если начала не было), epr — рост BTC от закрытия дня начала эпизода, %. Только прошлое.
function prepEp(G, thr = 20, gap = 30, key = '') {
  const B = K.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC');
  const r30 = B.ind.btcr30, Md = new Map(), Mr = new Map(); let s = -1, lastOn = -1e9;
  for (let i = 0; i < B.n; i++) {
    if (r30[i] > thr) { if (i - lastOn > gap) s = i; lastOn = i; }
    Md.set(B.t[i], s < 0 ? NaN : i - s); Mr.set(B.t[i], s < 0 ? NaN : (B.c[i] / B.c[s] - 1) * 100);
  }
  const f = (M) => (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const v = M.get(X.t[i]); a[i] = v == null ? NaN : v; } return a; };
  K.addInd(G, 'epd' + key, f(Md)); K.addInd(G, 'epr' + key, f(Mr));
  B.epS = []; // для epx: дни BTC, эпизоды
  Object.assign(prepEp, { B, Md, Mr });
}
// epx{x}_{D}: 1 в первый день эпизода, когда BTC выше закрытия дня начала эпизода на x% (не позже D дней от начала). Только прошлое.
function prepX(G, x, D) {
  const { B, Md, Mr } = prepEp, M = new Map(); let done = -1, s0 = -1;
  for (let i = 0; i < B.n; i++) {
    const d = Md.get(B.t[i]), r = Mr.get(B.t[i]), s = i - d;
    if (s !== s0) { s0 = s; done = 0; }
    let v = 0; if (!isNaN(d) && d <= D && !done && r > x) { v = 1; done = 1; }
    M.set(B.t[i], v);
  }
  K.addInd(G, `epx${x}_${D}`, (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = M.get(X.t[i]) || 0; return a; });
}
module.exports.prepX = prepX;
module.exports.prepEp = prepEp;
