/* Агент «ЛОУКАП», круг 2: продажа пампа лоукапа по обороту (объём дня > T% капитализации при монете > +U% от 90-дн. минимума).
   (1) плато события на отборе лоукапов и на стенде; (2) правило в стратегии: место (в начале / перед F), доля, флаг «лоукап».
   Запуск: node app/lowcap_loop2.js */
const L = require('./lowcap_sim.js'), { c } = L;
const G = L.load(), S0 = L.S0;
const b = L.evs(G, S0);
const H = [30, 90, 180], pct = (v) => (isNaN(v) ? '  -' : ((v >= 0 ? '+' : '') + (100 * v).toFixed(0)).padStart(4));
// событийный разбор (как в круге 1): медиана сверх лоукапов/монет группы того же дня
function evstudy(A, cond, gap = 30) {
  const xs = {}; for (const h of H) { const m = new Map(); for (const X of A) for (let i = 0; i + h < X.n; i++) { const t = X.t[i]; if (!m.has(t)) m.set(t, []); m.get(t).push(X.c[i + h] / X.c[i] - 1); } xs[h] = new Map([...m].map(([t, v]) => [t, L.med(v)])); }
  const E = { pre: [], post: [] }, coins = new Set();
  for (const X of A) { let last = -1e9; for (let i = 0; i < X.n; i++) if (cond(X, i) && i - last >= gap) { last = i; coins.add(X.name); E[X.t[i] < L.SPLIT ? 'pre' : 'post'].push(H.map((h) => (i + h < X.n ? (X.c[i + h] / X.c[i]) / (1 + xs[h].get(X.t[i])) - 1 : NaN))); } }
  const f = (e) => `${e.length} эп. 90д ${pct(L.med(e.map((x) => x[1]).filter((v) => !isNaN(v))))} (${(100 * e.filter((x) => x[1] < 0).length / Math.max(1, e.filter((x) => !isNaN(x[1])).length)).toFixed(0)}% вниз) 180д ${pct(L.med(e.map((x) => x[2]).filter((v) => !isNaN(v))))}`;
  return `монет ${coins.size} | до 06.2025: ${f(E.pre)} | после: ${f(E.post)}`;
}
const I = (X) => X.ind;
console.log('(1) Плато события «оборот дня > T% и up90 > U%» (сверх медианы группы того же дня; ожидаем «−»)');
for (const [gname, A] of [['отбор лоукапов', G.lsel], ['стенд (отбор+экзамен+50 случ.)', [...G.sel, ...G.ex, ...G.rnd]]]) {
  console.log(' ' + gname);
  for (const T of [30, 50, 100, 200]) for (const U of [50, 100, 200]) console.log(`   T=${T} U=${U}: ${evstudy(A, (X, i) => I(X).turn[i] > T && I(X).up90[i] > U)}`);
}
// (2) правило в стратегии
const FL = { 'все монеты': [], 'лоукап: доля < 1 б.п.': [c('mcsh90', '<', 1)], 'лоукап: доля < 3 б.п.': [c('mcsh90', '<', 3)], 'капитализация < $500 млн': [c('mcm90', '<', 500)] };
const iF = S0.rules.findIndex(L.isPump);
console.log('\n(2) Правило: [флаг], turn > T, up90 > U → продать s. Основа:', L.line('основа', b, b).split('\n').slice(1).join(' |'));
const out = [];
for (const [fn, fl] of Object.entries(FL)) for (const pos of ['начало', 'перед F']) for (const T of [50, 100, 200]) for (const U of [100]) for (const s of [0.05, 0.1, 0.2]) {
  const rule = { act: -s, conds: [...fl, c('turn', '>', T), c('up90', '>', U)] };
  const S = L.addRule(S0, rule, pos === 'начало' ? 0 : iF);
  const r = L.evs(G, S), tag = `${fn} | ${pos} | T=${T} U=${U} s=${s}`;
  console.log(L.line(tag, r, b));
  out.push({ tag, low: L.cmpLow(r, b, 'lsel'), std: L.cmpStd(r, b) });
}
// плато по U для лучшей формы
console.log('\n(2б) Плато по U и T (лоукап: доля < 1 б.п., в начале, s=0.1)');
for (const T of [30, 50, 75, 100, 150, 200]) for (const U of [50, 100, 200, 300]) {
  const S = L.addRule(S0, { act: -0.1, conds: [c('mcsh90', '<', 1), c('turn', '>', T), c('up90', '>', U)] }, 0), r = L.evs(G, S);
  const lo = L.cmpLow(r, b, 'lsel'), sd = L.cmpStd(r, b);
  console.log(`   T=${T} U=${U}: ЛОтбор ср.лог ${L.sg(lo.dlog)} мед ${L.sg(lo.dmed)} ${lo.u}/${lo.d} ${lo.strict ? '✔' : '·'} | стенд ${L.sg(sd.inc)} ${sd.pass ? '✔' : '·' + sd.why} 100н ${L.bw(r, b, 'n100').join('/')}`);
}
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lowcap/loop2.json', JSON.stringify(out));
