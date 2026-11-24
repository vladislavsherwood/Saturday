/* au: «золото и крипта» — предсказывает ли золото (серебро) крипту и наоборот. Общие помощники (research/au_journal.md).
   Основа — combo6 (found/combo6-best.json, 76 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + ловушка для фитилей (как в задании).
   Ряды металлов — cache/au_mkt.json (python3 au_data.py): GC=F, SI=F, GLD, SLV, PAXG-USD, XAUT-USD.
   Сопоставление с днём монеты t (сутки UTC): значение металла = последнее закрытие с торговой датой ≤ t (выходные/праздники — перенос вперёд,
   только прошлое; закрытие COMEX ≈ 21–22 UTC раньше конца суток крипты). Решение стенда — по вчерашнему дню, худший из сдвигов 0/1.
   Индикаторы (на днях монеты, все по прошлому):
     auc — золото (GC=F), agc — серебро (SI=F); au_rN / ag_rN — рост металла за N дней, % (N = 7, 14, 30, 60, 90);
     au_ath / ag_ath — просадка от максимума за всю историю ряда, % (≥ 0); au_hiN — 1, если золото на N-дневном максимуме (N = 60, 250), иначе 0;
     au_hid — дней с последнего максимума за всю историю (рекорда) золота; au_s200 — золото / 200-дн. средняя;
     bg — BTC / золото; bg_sN — bg / средняя bg за N дней (N = 90, 200, 365); bg_r30, bg_r90 — рост bg за 30/90 дней, %;
     cg_r30, cg_r90 — то же для монеты к золоту (монета / золото);
     au_cN — корреляция дневных лог-доходностей BTC и золота за N дней (N = 30, 90).
   Использование: const A = require('./au_lib.js'); A.run('имя', S) — строка отчёта к combo6 (r4_lib.run + половины + средний лог 81). */
const fs = require('fs');
const AS = require('./agent_sim.js');
AS.PAGES.mine = ['mine'];
require('./combo2_sim.js').load(['sel', 'ex', 'rnd', 'n100', 'mine']);
const H = require('./h2_lib.js'); // h2fd15 для правила 11
const L = require('./r4_lib.js'), { P, Z, G, c } = L;
L.addInd('hvv', (X) => Float64Array.from(X.ind.vol180, (v, i) => (isFinite(v) ? v : X.ind.vol90[i])));
const ld = (f) => ({ ...L.clone(), rules: require('./found/' + f).rules.map((r) => JSON.parse(JSON.stringify(r))) });
const S6 = ld('combo6-best.json');
const WICK = { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' };
const polW = { ...L.pol0, wick: WICK };
const T = (s) => Math.round(Date.parse(s) / 864e5), day = L.day;
const MK = JSON.parse(fs.readFileSync(__dirname + '/cache/au_mkt.json', 'utf8'));
// ряд металла на календарных днях [t0, t1]: перенос вперёд
function cal(sym, t0, t1) {
  const s = MK[sym], n = t1 - t0 + 1, o = new Float64Array(n).fill(NaN); if (!s) return o;
  let k = 0; const td = s.d.map(T);
  for (let i = 0; i < n; i++) { const t = t0 + i; while (k < td.length && td[k] <= t) k++; if (k > 0) o[i] = s.c[k - 1]; }
  return o;
}
const T0 = T('2009-01-02'), T1 = T('2026-12-31');
const AU = cal('GC=F', T0, T1), AG = cal('SI=F', T0, T1), PX = cal('PAXG-USD', T0, T1);
// BTC по календарю (из страницы отбора)
const BY = {}; for (const g of ['sel', 'ex', 'rnd', 'n100', 'mine']) for (const X of G[g]) BY[X.name] = BY[X.name] || X;
const BX = BY.BTC, BTC = new Float64Array(T1 - T0 + 1).fill(NaN); for (let i = 0; i < BX.n; i++) { const k = BX.t[i] - T0; if (k >= 0 && k < BTC.length) BTC[k] = BX.c[i]; }
// производные на календаре
const n = AU.length;
const ret = (A, w) => Float64Array.from(A, (v, i) => (i >= w ? (v / A[i - w] - 1) * 100 : NaN));
const ath = (A) => { let m = 0; return Float64Array.from(A, (v) => { if (v > m) m = v; return isFinite(v) ? (1 - v / m) * 100 : NaN; }); };
const hiN = (A, w) => Float64Array.from(A, (v, i) => { if (i < w) return NaN; let m = 0; for (let k = i - w + 1; k <= i; k++) if (A[k] > m) m = A[k]; return v >= m ? 1 : 0; });
const sma = (A, w) => { const o = new Float64Array(A.length).fill(NaN); let s = 0, m = 0; for (let i = 0; i < A.length; i++) { if (isFinite(A[i])) { s += A[i]; m++; } if (i >= w && isFinite(A[i - w])) { s -= A[i - w]; m--; } if (i >= w - 1 && m === w) o[i] = A[i] / (s / w); } return o; };
const hid = (A) => { let m = 0, at = -1; return Float64Array.from(A, (v, i) => { if (v >= m) { m = v; at = i; } return at < 0 ? NaN : i - at; }); };
// корреляция доходностей BTC и золота за w календарных дней: доходности между соседними торговыми днями золота (BTC — за тот же отрезок)
const TD = (() => { const td = new Set(MK['GC=F'].d.map(T)); return Float64Array.from({ length: T1 - T0 + 1 }, (_, i) => (td.has(T0 + i) ? 1 : 0)); })();
const corr = (A, B, w) => { const o = new Float64Array(A.length).fill(NaN), ra = new Float64Array(A.length).fill(NaN), rb = new Float64Array(A.length).fill(NaN); let p = -1;
  for (let i = 0; i < A.length; i++) if (TD[i]) { if (p >= 0 && isFinite(A[i]) && isFinite(A[p])) { ra[i] = Math.log(A[i] / A[p]); rb[i] = Math.log(B[i] / B[p]); } p = i; }
  for (let i = w; i < A.length; i++) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, m = 0; for (let k = i - w + 1; k <= i; k++) { const x = ra[k], y = rb[k]; if (!isFinite(x) || !isFinite(y)) continue; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; m++; }
    if (m >= w * 0.4) { const cv = sab / m - (sa / m) * (sb / m), va = saa / m - (sa / m) ** 2, vb = sbb / m - (sb / m) ** 2; o[i] = cv / Math.sqrt(va * vb); } } return o; };
const CAL = { auc: AU, agc: AG, pxc: PX, btcc: BTC };
for (const w of [7, 14, 30, 60, 90]) { CAL['au_r' + w] = ret(AU, w); CAL['ag_r' + w] = ret(AG, w); }
CAL.au_ath = ath(AU); CAL.ag_ath = ath(AG); CAL.au_hi60 = hiN(AU, 60); CAL.au_hi250 = hiN(AU, 250); CAL.au_hid = hid(AU); CAL.au_s200 = sma(AU, 200); CAL.ag_s200 = sma(AG, 200);
const BG = Float64Array.from(BTC, (v, i) => v / AU[i]); CAL.bg = BG;
for (const w of [90, 200, 365]) CAL['bg_s' + w] = sma(BG, w);
CAL.bg_r30 = ret(BG, 30); CAL.bg_r90 = ret(BG, 90);
CAL.au_c30 = corr(BTC, AU, 30); CAL.au_c90 = corr(BTC, AU, 90);
const onDays = (A, X) => Float64Array.from(X.ind.t, (t) => { const k = t - T0; return k >= 0 && k < n ? A[k] : NaN; });
for (const g in G) for (const X of G[g]) {
  for (const k in CAL) X.ind[k] = onDays(CAL[k], X);
  const cg = Float64Array.from(X.c, (v, i) => v / X.ind.auc[i]);
  X.ind.cg_r30 = Float64Array.from(cg, (v, i) => (i >= 30 ? (v / cg[i - 30] - 1) * 100 : NaN));
  X.ind.cg_r90 = Float64Array.from(cg, (v, i) => (i >= 90 ? (v / cg[i - 90] - 1) * 100 : NaN));
}
P.setBaseline(S6, polW);
const G3 = ['sel', 'ex', 'rnd'], L1 = Z.L1;
let BN = null;
const base100 = () => BN || (BN = P.evc(S6, polW, ['n100']));
// половины: Σ лог-медиан h1/h2 к основе; средний лог 81 (лучше/хуже)
function halves(R) { const { BR } = P.baseline(); const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }; const o = {}; for (const h of ['h1', 'h2']) { let d = 0; for (const g of G3) d += L1(med(R[g].map((x) => x[h]))) - L1(med(BR[g].map((x) => x[h]))); o[h] = d; } return o; }
const sg = L.sg;
function run(nm, S, pol = polW, o = {}) {
  const r = L.run(nm, S, pol, { n100: o.n100 !== false, quiet: true }), { BR } = P.baseline(), hv = halves(r.R), m81 = Z.mlog(r.R, BR, 'all', G3);
  r.hv = hv; r.m81 = m81;
  r.s = `${nm.padEnd(o.w || 46)} ${G3.map((g) => Math.round(r.RS[g].all.med)).join('/')} | ${sg(r.dseg.all)} к${sg(r.dseg.big)} а${sg(r.dseg.alt)} м${sg(r.dseg.meme)} ${r.w ? '✗' : '✔'}` +
    (r.n100 ? ` | 100н ${sg(r.n100.m)} ${r.n100.u}/${r.n100.d}` : '') + ` | пол ${sg(hv.h1)}/${sg(hv.h2)} | 81 ${(m81.m >= 0 ? '+' : '') + m81.m.toFixed(4)} ${m81.u}/${m81.d}` + (r.w ? ' | ' + r.w.slice(0, 140) : '');
  if (!o.quiet) console.log(r.s);
  return r;
}
// вставка правил: at — индекс в списке 76 правил (0 — первыми)
function ins(rules, at, S = S6) { const Tt = L.clone(S); Tt.rules.splice(at, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return Tt; }
// перед каждым правилом, где pick(r, k) → true, вставить копию mod(копия) (null — не вставлять)
function preMod(S, pick, mod) { const Tt = L.clone(S); Tt.rules = S.rules.flatMap((r, k) => { const r0 = JSON.parse(JSON.stringify(r)); if (!pick(r, k)) return [r0]; const m = mod(JSON.parse(JSON.stringify(r)), k); return m ? [m, r0] : [r0]; }); return Tt; }
// условие‑фильтр к правилам: добавить conds к правилам, где pick
function addTo(S, pick, conds) { const Tt = L.clone(S); Tt.rules = S.rules.map((r, k) => { const r0 = JSON.parse(JSON.stringify(r)); if (pick(r, k)) r0.conds.push(...conds.map((x) => ({ ...x }))); return r0; }); return Tt; }
// монеты пользователя
const MINE = ['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'ENA', 'ZEC', 'PENGU', 'HYPE', 'PUMP', 'XMR', 'FARTCOIN', 'USELESS'];
const E = (X, S, pol) => Math.min(P.edge(X, S, 0, 'full', false, pol).e, P.edge(X, S, 1, 'full', false, pol).e);
const cut = (Y, from) => { const a = Y.ind.t.findIndex((t) => t >= T(from)); const Zc = { ...Y, n: Y.n - a, c: Y.c.slice(a), h: Y.h.slice(a), l: Y.l.slice(a), ind: {} }; for (const k in Y.ind) Zc.ind[k] = Y.ind[k].slice ? Y.ind[k].slice(a) : Y.ind[k]; Zc.t = Zc.ind.t; return Zc; };
// все монеты (181) для диагностики
const XS = []; for (const g of ['sel', 'ex', 'rnd', 'n100']) XS.push(...G[g]);
module.exports = { TD, L, P, Z, G, c, H, S6, polW, WICK, T, day, MK, cal, CAL, T0, T1, AU, AG, PX, BTC, BY, XS, run, ins, preMod, addTo, halves, base100, MINE, E, cut, sg, L1, G3 };
