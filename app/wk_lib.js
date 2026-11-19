/* wk: 5 кругов доводки «ловушки для фитилей» поверх combo4. Общие помощники поверх r4_lib.js.
   Основа сравнения — combo4 (строгая проверка, доход Σ лог-медиан); вторая точка отсчёта — исходная ловушка dcaf
   T0 = −25/−40/−60% → 10/20/30% резерва, монете > 60 дн, заявки от вчерашнего закрытия каждый день.
   Монеты пользователя, которых нет в группах оценщика (ENA, ZEC, USELESS), — страница 'mine' (подгружается сюда же, в оценку не входит).
   Использование: const W = require('./wk_lib.js'); W.ev('имя', W.pol({ every: 3, once: 1 }), { n100: true }) */
const AS = require('./agent_sim.js');
AS.PAGES.mine = ['mine'];
require('./combo2_sim.js').load(['sel', 'ex', 'rnd', 'n100', 'mine']);
const L = require('./r4_lib.js'), { P, Z, G, S0, pol0 } = L;
const LV0 = [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]];
const pol = (o = {}, base = pol0) => ({ ...base, wick: { lv: LV0, age: 60, ...o } });
const T0 = pol();
const med = Z.med, L1 = Z.L1, G3 = ['sel', 'ex', 'rnd'];
// доход по половинам истории: Σ лог-медиан h1 / h2 (как inc, но по половинам)
const incH = (R, h, s = 'all') => G3.reduce((t, g) => { const a = R[g].filter((x) => s === 'all' || x.seg === s).map((x) => x[h]); return t + (a.length ? L1(med(a)) : 0); }, 0);
let BR = null, TR = null, TS = null, BN = null, TN = null;
function bases() {
  if (!BR) { BR = P.evc(S0, pol0); TR = P.evc(S0, T0); TS = Z.sum(TR); BN = P.evc(S0, pol0, ['n100']); TN = P.evc(S0, T0, ['n100']); }
  return { BR, TR, TS, BN, TN };
}
const sg = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
const rows = [];
/* оценка варианта: медианы групп, доход к combo4 (всё/к/а/м), строгая к combo4, доход к T0, половины (к combo4), 100 новых (к combo4 и к T0) */
function ev(nm, p, { n100 = false, S = S0, quiet = false, w = 46 } = {}) {
  bases();
  const R = P.evc(S, p), RS = Z.sum(R), { BS } = P.baseline();
  const d = (s) => Z.inc(RS, s) - Z.inc(BS, s);
  const why = Z.SEGS.map((s) => { const x = Z.strict(RS, BS, s); return x.length ? `${s}: ${x.join(',')}` : ''; }).filter(Boolean).join(' | ');
  const o = { nm, sel: RS.sel.all.med, ex: RS.ex.all.med, rnd: RS.rnd.all.med, all: d('all'), big: d('big'), alt: d('alt'), meme: d('meme'), ok: !why, why,
    dT: Z.inc(RS, 'all') - Z.inc(TS, 'all'), h1: incH(R, 'h1') - incH(BR, 'h1'), h2: incH(R, 'h2') - incH(BR, 'h2'), R, RS };
  { const m = Z.mlog(R, BR, 'all', G3), mt = Z.mlog(R, TR, 'all', G3); Object.assign(o, { m81: m.m, m81u: m.u, m81d: m.d, m81T: mt.m }); } // средний лог по 81 монете (устойчивее медиан)
  if (n100) { const N = P.evc(S, p, ['n100']), m = Z.mlog(N, BN, 'all', ['n100']), mt = Z.mlog(N, TN, 'all', ['n100']); Object.assign(o, { n: m.m, nu: m.u, nd: m.d, nT: mt.m, nTu: mt.u, nTd: mt.d, N }); }
  o.txt = `${nm.padEnd(w)} ${Math.round(o.sel)}/${Math.round(o.ex)}/${Math.round(o.rnd)} | ${sg(o.all)} к${sg(o.big, 2)} а${sg(o.alt, 2)} м${sg(o.meme, 2)} ${o.ok ? '✔' : '✗'} | кT0 ${sg(o.dT)} | 81: ${sg(o.m81)} ${o.m81u}/${o.m81d} кT0 ${sg(o.m81T)} | пол ${sg(o.h1, 2)}/${sg(o.h2, 2)}` +
    (n100 ? ` | 100н ${sg(o.n)} ${o.nu}/${o.nd} кT0 ${sg(o.nT)} ${o.nTu}/${o.nTd}` : '') + (why ? ` | ${why.slice(0, 120)}` : '');
  if (!quiet) console.log(o.txt);
  rows.push(o);
  return o;
}
const head = () => console.log(`${'вариант'.padEnd(46)} отбор/экзамен/50сл | доход к combo4: всё к а м строгая | к исходной ловушке T0 | 81 монета: ср. лог к combo4 лучше/хуже, к T0 | половины к combo4 h1/h2 | 100 новых: лог к combo4 лучше/хуже, к T0`);
// день t (дни с 1970) по строке даты
const T = (s) => Math.round(Date.parse(s) / 864e5);
const day = L.day;
// все монеты по имени (включая 'mine')
const BY = {}; for (const g in G) for (const X of G[g]) BY[X.name] = BY[X.name] || X;
// дневная волатильность σ (vol90 — годовая, %) на дне j
const sd = (X, j) => { const v = X.ind.vol90[j]; return isFinite(v) && v > 0 ? v / 100 / Math.sqrt(365) : NaN; };
module.exports = { L, P, Z, G, S0, pol0, LV0, pol, T0, ev, head, rows, sg, T, day, BY, sd, incH, bases };
