/* op: «опционы и стратегия» — помогают ли данные опционного рынка combo6 / combo7-draft. Общие помощники (research/op_journal.md).
   Стенд — au_lib.js (combo6 76 правил + отложенная паника Boost(2) + фитили; оценщик r4_lib.run + половины + средний лог 81), без его изменения.
   Основа сравнения переключается: base('c6') — combo6-best.json, base('c7') — combo7-draft.json (101 правило; индикаторы золота agau30/au_r30 — из au_lib).
   Данные: cache/op_mkt.json (python3 op_data.py: Yahoo ^VIX, ^VIX9D, ^VIX3M, ^VIX6M, ^VVIX, ^SKEW, ^GVZ, ^OVX, ^MOVE, ^VXN, ^GSPC; Deribit DVOL BTC/ETH с 2021-03-24),
           cache/op_pc.json (python3 op_pc.py: put/call CBOE total/equity/index с 2006-11, vix/spx с 2019-10).
   Сопоставление с днём монеты t (сутки UTC): значение = последнее значение с датой ≤ t (выходные/праздники — перенос вперёд, только прошлое).
   Закрытие США ≈ 20–21 UTC торговой даты D (раньше конца суток крипты D); DVOL — свеча суток UTC D (close = значение в 24:00 UTC D, как закрытие монеты).
   Стенд решает по вчерашнему дню, худший из сдвигов исполнения 0/1 — заглядывания вперёд нет.
   Индикаторы (на днях монеты; NaN — нет данных → условие правила ложно):
     op_vix — VIX; op_vixr — VIX / его SMA50 (торговые дни; как st_vixr); op_vixp — перцентиль VIX за 250 торговых дней (0…1);
     op_ts — VIX9D / VIX3M (> 1 — инверсия структуры срочности, паника); op_ts1 — VIX / VIX3M; op_ts6 — VIX3M / VIX6M;
     op_vvix — VVIX; op_vvixr — VVIX / SMA50; op_skew — CBOE SKEW; op_skewz — SKEW минус его средняя за 250 торговых дней;
     op_gvz, op_gvzr — вол золота и к SMA50; op_ovx, op_ovxr — нефть; op_move, op_mover — облигации (MOVE);
     op_vrp — VIX / реализованная вол S&P 500 за 21 торговый день (годовая, %); op_spxr7 — S&P за 7 кал. дней, %;
     op_pce — put/call по акциям (equity, CBOE), op_pce10 — средняя за 10 торговых дней; op_pct, op_pct10 — total; op_pci — index;
     op_pcez — (op_pce10 − средняя pce10 за 250 т.д.) / ст.откл. за 250 т.д.;
     op_dv — DVOL BTC; op_dve — DVOL ETH; op_dverat — DVOL ETH / DVOL BTC; op_dvr — DVOL / его SMA50 (кал. дни); op_dvr7 — DVOL / DVOL 7 дней назад;
     op_dvp — перцентиль DVOL за 365 дней; op_dvrv — DVOL / реализованная вол BTC за 30 дней (годовая, √365, %);
     op_rv30 — реализованная вол BTC 30 дн (%, годовая; есть и до 2021); op_rvr — rv30 / SMA90(rv30) (для периода без DVOL — замена DVOL-всплеска);
     op_dvlo — DVOL на минимуме 90 дней (1/0); op_dvmin — DVOL / его минимум за 365 дней.
   Использование: const O = require('./op_lib.js'); O.base('c6'); O.run('имя', S) — строка отчёта к выбранной основе. */
const fs = require('fs');
const A = require('./au_lib.js');
const { L, P, G, c, S6, polW, T, day } = A;
L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const ld = (f) => ({ ...L.clone(), rules: require('./found/' + f).rules.map((r) => JSON.parse(JSON.stringify(r))) });
const S7 = ld('combo7-draft.json');
let BASE = 'c6';
function base(k = 'c6') { BASE = k; P.setBaseline(k === 'c7' ? S7 : S6, polW); return k === 'c7' ? S7 : S6; }
const SB = () => (BASE === 'c7' ? S7 : S6);

// ---------- ряды на календарной оси ----------
const MK = JSON.parse(fs.readFileSync(__dirname + '/cache/op_mkt.json', 'utf8'));
const PC = JSON.parse(fs.readFileSync(__dirname + '/cache/op_pc.json', 'utf8')).days;
const T0 = T('2006-01-01'), T1 = T('2027-01-01'), NT = T1 - T0;
const TR = {}; for (const s in MK) TR[s] = { t: MK[s].d.map(T), c: MK[s].c };
for (const k of ['total', 'equity', 'index', 'vix', 'spx']) { const ds = Object.keys(PC).filter((d) => isFinite(PC[d][k])).sort(); TR['pc_' + k] = { t: ds.map(T), c: ds.map((d) => PC[d][k]) }; }
function calv(tr, v = tr.c) { const a = new Float64Array(NT).fill(NaN); let k = 0, last = NaN; for (let i = 0; i < NT; i++) { const t = T0 + i; while (k < tr.t.length && tr.t[k] <= t) { last = v[k]; k++; } a[i] = last; } return a; }
// по торговым дням ряда
const smaR = (v, w) => { const n = v.length, o = new Array(n).fill(NaN); let s = 0; for (let i = 0; i < n; i++) { s += v[i]; if (i >= w) s -= v[i - w]; if (i >= w - 1) o[i] = s / w; } return o; };
const ratioSma = (v, w) => { const m = smaR(v, w); return v.map((x, i) => x / m[i]); };
const pctR = (v, w) => v.map((x, i) => { if (i < w - 1) return NaN; let b = 0; for (let k = i - w + 1; k <= i; k++) if (v[k] <= x) b++; return b / w; });
const zR = (v, w) => v.map((x, i) => { if (i < w - 1) return NaN; let s = 0, s2 = 0; for (let k = i - w + 1; k <= i; k++) { s += v[k]; s2 += v[k] * v[k]; } const m = s / w, sd = Math.sqrt(Math.max(1e-12, s2 / w - m * m)); return (x - m) / sd; });
// пара рядов по общим торговым датам: f(a, b) на датах второго ряда
function pair(s1, s2, f) { const m = new Map(TR[s1].t.map((t, i) => [t, TR[s1].c[i]])); const t = [], v = []; TR[s2].t.forEach((tt, i) => { const a = m.get(tt); if (a != null) { t.push(tt); v.push(f(a, TR[s2].c[i])); } }); return { t, c: v }; }
const M = {};
const V = (s) => TR[s].c;
M.op_vix = calv(TR['^VIX']); M.op_vixr = calv(TR['^VIX'], ratioSma(V('^VIX'), 50)); M.op_vixp = calv(TR['^VIX'], pctR(V('^VIX'), 250));
M.op_ts = calv(pair('^VIX9D', '^VIX3M', (a, b) => a / b)); M.op_ts1 = calv(pair('^VIX', '^VIX3M', (a, b) => a / b)); M.op_ts6 = calv(pair('^VIX3M', '^VIX6M', (a, b) => a / b));
M.op_vvix = calv(TR['^VVIX']); M.op_vvixr = calv(TR['^VVIX'], ratioSma(V('^VVIX'), 50));
M.op_skew = calv(TR['^SKEW']); { const v = V('^SKEW'), m = smaR(v, 250); M.op_skewz = calv(TR['^SKEW'], v.map((x, i) => x - m[i])); }
M.op_gvz = calv(TR['^GVZ']); M.op_gvzr = calv(TR['^GVZ'], ratioSma(V('^GVZ'), 50));
M.op_ovx = calv(TR['^OVX']); M.op_ovxr = calv(TR['^OVX'], ratioSma(V('^OVX'), 50));
M.op_move = calv(TR['^MOVE']); M.op_mover = calv(TR['^MOVE'], ratioSma(V('^MOVE'), 50));
{ const v = V('^GSPC'), lr = v.map((x, i) => (i ? Math.log(x / v[i - 1]) : 0)), rv = v.map((_, i) => { if (i < 21) return NaN; let s = 0, s2 = 0; for (let k = i - 20; k <= i; k++) { s += lr[k]; s2 += lr[k] * lr[k]; } return Math.sqrt(Math.max(0, s2 / 21 - (s / 21) ** 2) * 252) * 100; });
  const m = new Map(TR['^GSPC'].t.map((t, i) => [t, rv[i]])); const t = [], c2 = []; TR['^VIX'].t.forEach((tt, i) => { const r = m.get(tt); if (r != null && isFinite(r)) { t.push(tt); c2.push(V('^VIX')[i] / r); } }); M.op_vrp = calv({ t, c: c2 });
  const sp = calv(TR['^GSPC']); M.op_spxr7 = Float64Array.from(sp, (x, i) => (i >= 7 ? (x / sp[i - 7] - 1) * 100 : NaN)); }
M.op_pce = calv(TR.pc_equity); M.op_pce10 = calv(TR.pc_equity, smaR(V('pc_equity'), 10)); M.op_pct = calv(TR.pc_total); M.op_pct10 = calv(TR.pc_total, smaR(V('pc_total'), 10)); M.op_pci = calv(TR.pc_index);
M.op_pcez = calv(TR.pc_equity, zR(smaR(V('pc_equity'), 10).map((x) => (isFinite(x) ? x : 0.6)), 250));
// DVOL — календарные дни
M.op_dv = calv(TR.DVOL_BTC); M.op_dve = calv(TR.DVOL_ETH); M.op_dverat = Float64Array.from(M.op_dve, (x, i) => x / M.op_dv[i]);
const calSma = (a, w) => { const o = new Float64Array(NT).fill(NaN); for (let i = w - 1; i < NT; i++) { let s = 0, ok = true; for (let k = i - w + 1; k <= i; k++) { if (!isFinite(a[k])) { ok = false; break; } s += a[k]; } if (ok) o[i] = s / w; } return o; };
{ const dv = M.op_dv, m50 = calSma(dv, 50); M.op_dvr = Float64Array.from(dv, (x, i) => x / m50[i]); M.op_dvr7 = Float64Array.from(dv, (x, i) => (i >= 7 ? x / dv[i - 7] : NaN));
  M.op_dvp = Float64Array.from(dv, (x, i) => { if (i < 364 || !isFinite(dv[i - 364])) return NaN; let b = 0; for (let k = i - 364; k <= i; k++) if (dv[k] <= x) b++; return b / 365; });
  M.op_dvlo = Float64Array.from(dv, (x, i) => { if (i < 89 || !isFinite(dv[i - 89])) return NaN; for (let k = i - 89; k <= i; k++) if (dv[k] < x) return 0; return 1; });
  M.op_dvmin = Float64Array.from(dv, (x, i) => { if (i < 364 || !isFinite(dv[i - 364])) return NaN; let m = Infinity; for (let k = i - 364; k <= i; k++) m = Math.min(m, dv[k]); return x / m; }); }
// реализованная вол BTC (ряд BTC с отбора, календарь au_lib)
{ const B = new Float64Array(NT).fill(NaN); for (let i = 0; i < A.BTC.length; i++) { const k = A.T0 + i - T0; if (k >= 0 && k < NT) B[k] = A.BTC[i]; }
  const lr = Float64Array.from(B, (x, i) => (i && isFinite(x) && isFinite(B[i - 1]) ? Math.log(x / B[i - 1]) : NaN));
  const rv = new Float64Array(NT).fill(NaN); for (let i = 30; i < NT; i++) { let s = 0, s2 = 0, m = 0; for (let k = i - 29; k <= i; k++) if (isFinite(lr[k])) { s += lr[k]; s2 += lr[k] ** 2; m++; } if (m >= 25) rv[i] = Math.sqrt(Math.max(0, s2 / m - (s / m) ** 2) * 365) * 100; }
  M.op_rv30 = rv; const m90 = calSma(rv, 90); M.op_rvr = Float64Array.from(rv, (x, i) => x / m90[i]);
  M.op_dvrv = Float64Array.from(M.op_dv, (x, i) => x / rv[i]); M.BTC = B; }
const at = (a, t) => { const i = t - T0; return i >= 0 && i < NT ? a[i] : NaN; };
for (const k in M) if (k.startsWith('op_')) L.addInd(k, (X) => Float64Array.from(X.ind.t, (t) => at(M[k], t)));
// VIX-шок st (B) для сравнения: st_vixr = op_vixr (то же определение: VIX / SMA50 по торговым дням)
L.addInd('st_vixr', (X) => X.ind.op_vixr); L.addInd('st_vix', (X) => X.ind.op_vix);

// ---------- оценка ----------
const sg = A.sg, L1 = A.L1, G3 = A.G3;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
function halves(R) { const { BR } = P.baseline(); const o = {}; for (const h of ['h1', 'h2']) { let d = 0; for (const g of G3) d += L1(med(R[g].map((x) => x[h]))) - L1(med(BR[g].map((x) => x[h]))); o[h] = d; } return o; }
// строка отчёта к текущей основе; r.ok — формальные пункты 1, 2, 4 критерия (доход > 0, строгая, 100н > 0 и лучше ≥ хуже, половины ≥ −0,005)
function run(nm, S, pol = polW, o = {}) {
  const r = L.run(nm, S, pol, { n100: o.n100 !== false, quiet: true }), { BR } = P.baseline();
  r.hv = halves(r.R); r.m81 = L.Z.mlog(r.R, BR, 'all', G3);
  r.ok = !r.w && r.dseg.all > 0 && (!r.n100 || (r.n100.m > 0 && r.n100.u > r.n100.d)) && r.hv.h1 >= -0.005 && r.hv.h2 >= -0.005;
  r.s = `${nm.padEnd(o.w || 50)} ${G3.map((g) => Math.round(r.RS[g].all.med)).join('/')} | ${sg(r.dseg.all)} к${sg(r.dseg.big)} а${sg(r.dseg.alt)} м${sg(r.dseg.meme)} ${r.w ? '✗' : '✔'}` +
    (r.n100 ? ` | 100н ${sg(r.n100.m)} ${r.n100.u}/${r.n100.d}` : '') + ` | пол ${sg(r.hv.h1)}/${sg(r.hv.h2)} | 81 ${(r.m81.m >= 0 ? '+' : '') + r.m81.m.toFixed(4)} ${r.m81.u}/${r.m81.d}` + (r.ok ? ' ★' : '') + (r.w ? ' | ' + r.w.slice(0, 120) : '');
  if (!o.quiet) console.log(r.s);
  return r;
}
// перед каждым правилом основы, где pick(r, k) → true, вставить копию mod(копия, k) (null — не вставлять)
function preMod(pick, mod, S = SB()) { const Q = L.clone(S); Q.rules = S.rules.flatMap((r, k) => { const r0 = JSON.parse(JSON.stringify(r)); if (!pick(r, k)) return [r0]; const m = mod(JSON.parse(JSON.stringify(r)), k); return m ? [m, r0] : [r0]; }); return Q; }
function ins(rules, k, S = SB()) { const Q = L.clone(S); Q.rules.splice(k === 'end' ? Q.rules.length : k, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return Q; }
function gate(pick, conds, S = SB()) { const Q = L.clone(S); Q.rules.forEach((r, k) => { if (pick(S.rules[k], k)) r.conds.push(...conds.map((x) => ({ ...x }))); }); return Q; }
/* семьи правил по самому правилу (работает и для combo6, и для combo7-draft): индекс правила в combo6 по совпадению без условий agau30/au_r30/age-копий.
   combo6 (0-based): 0–8 покупки (страх<10, ликвидации, паника в стейблах), 9–10 охрана, 11–26 продажи на страхе, 27 разворот BTC, 28–30 фандинг,
   31–38 qt, 39–58 вершина, 59 покупка 60, 60–68 памп, 69 альты, 70–75 эйфория. */
const KEY = (r) => JSON.stringify({ a: r.act, c: r.conds });
const IDX6 = new Map(S6.rules.map((r, k) => [KEY(r), k]));
const FAM = (q) => (q <= 8 ? 'buy' : q <= 10 ? 'guard' : q <= 26 ? 'fear' : q === 27 ? 'rev' : q <= 30 ? 'fund' : q <= 38 ? 'qt' : q <= 58 ? 'top' : q === 59 ? 'b60' : q <= 68 ? 'pump' : q === 69 ? 'alt' : 'euph');
// семья правила основы: 'buy', 'fear', … ; копии combo7 (agau30 / au_r30) → 'k1' / 'k4'
function famOf(r) { const q = IDX6.get(KEY(r)); if (q != null) return FAM(q); if (r.conds.some((x) => x.ind === 'agau30')) return 'k1'; if (r.conds.some((x) => x.ind === 'au_r30')) return 'k4'; return 'other'; }
const isBuy = (r) => famOf(r) === 'buy', isFear = (r) => famOf(r) === 'fear';
const buyAct = (a, m) => +(1 + (a - 1) * m).toFixed(6); // долю резерва × m (act > 1 — покупка из резерва)
const sellAct = (a, m) => +Math.max(-1, a * m).toFixed(6); // продажу × m (act < 0)
// монеты пользователя: итог к DCA (вся история, худший из сдвигов 0/1)
const MINE = A.MINE, BY = A.BY, E = A.E;
function mine(S, pol = polW, S0 = SB()) { return MINE.map((nm) => { const X = BY[nm]; if (!X) return { nm, miss: 1 }; return { nm, b: E(X, S0, polW), x: E(X, S, pol) }; }); }
const mineTxt = (rows) => rows.map((r) => (r.miss ? `${r.nm}: нет` : `${r.nm} ${Math.round(r.b)}→${Math.round(r.x)} (${sg(L1(r.x) - L1(r.b))})`)).join(', ');
const XS = A.XS;
const LOG = '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/op/';
// вывод в консоль и в лог scratchpad/op/<name>.txt
function tee(name) { const f = LOG + name + '.txt'; fs.mkdirSync(LOG, { recursive: true }); fs.writeFileSync(f, ''); const o = console.log; console.log = (...a) => { const s = a.join(' '); o(s); fs.appendFileSync(f, s + '\n'); }; }
module.exports = { A, L, P, G, c, S6, S7, polW, base, SB, M, TR, T0, NT, at, T, day, run, preMod, ins, gate, famOf, isBuy, isFear, buyAct, sellAct, FAM, IDX6, mine, mineTxt, MINE, BY, E, XS, sg, L1, G3, halves, tee, LOG, PC, MK };
