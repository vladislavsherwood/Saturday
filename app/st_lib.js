/* st: «крипта то сильнее, то слабее фондового рынка — фильтр?» Общие помощники (research/st_journal.md).
   Основа — combo6 (found/combo6-best.json, 76 правил) + отложенная паника Boost(2, { k: 0, A: 0 }) + фитили (−25/−40/−60% → 15/25/35%, раз в 3 дня).
   Ряды фондового рынка — cache/st_mkt.json (python3 st_data.py: Yahoo через data.history). Торговая дата биржи → календарный день крипты;
   выходные и праздники — последнее известное закрытие (ffill), только прошлое. Закрытие США (~21:00 UTC) раньше закрытия суток крипты (00:00 UTC),
   решение стенда — по вчерашнему дню (худший из сдвигов исполнения 0/1), так что заглядывания вперёд нет.
   Индикаторы (все добавляются всем монетам, NaN — нет данных → правило не срабатывает):
     рынок (одинаковы для всех монет):
       st_spx200, st_ndx200, st_ndx50 — S&P 500 / Nasdaq-100 к своей SMA200 / SMA50 (по торговым дням);
       st_ndxr7, st_ndxr30, st_ndxr90, st_spxr7 — изменение индекса за 7/30/90 календарных дней, %;
       st_ndxdd — просадка Nasdaq-100 от максимума 252 торговых дней, % (≥ 0); st_spxdd — то же S&P;
       st_vix — VIX; st_vixr — VIX / его SMA50;
       st_dxy200, st_dxyr30 — DXY к SMA200, изменение за 30 дн, %; st_tnxd30, st_tnxd90 — изменение доходности 10-летних, п.п. (4,9 = 4,9%);
       st_gld200, st_gldr90 — золото к SMA200, рост за 90 дн, %; st_nvda200, st_nvdar30 — NVDA;
       st_bxr30, st_bxr90 — BTC минус Nasdaq-100 за 30/90 дн (разность лог-доходностей, %): «крипта сильнее/слабее акций»;
       st_bxz — лог(BTC/NDX) минус его средняя за 200 дн (×100): «перепроданность крипты относительно риска»;
       st_bxc30, st_bxc90 — корреляция дневных доходностей BTC и NDX за 30/90 торговых дней NDX (BTC — закрытия в те же даты);
       st_bxdiv — NDX в пределах 3% от максимума 252 дн (1/0) при BTC ниже своего максимума 365 дн больше чем на 25% (1/0): «акции на вершине, крипта нет».
     монета: st_cxr30, st_cxr90 — монета минус NDX за 30/90 дн, %; st_cxc90 — корреляция монеты с NDX за 90 торговых дней.
   Использование: const ST = require('./st_lib.js'); ST.ev('имя', S) — строка L.run + половины + 81 + монеты пользователя по запросу. */
const fs = require('fs');
const H = require('./hv_lib.js'); // страница 'mine' (монеты пользователя), h2fd15, hvv, BY, MINE, E
const L = H.L, { P, G, c } = L;
const ld = (f) => ({ ...L.clone(), rules: require('./found/' + f).rules.map((r) => JSON.parse(JSON.stringify(r))) });
const S6 = ld('combo6-best.json');
const polW = { ...L.pol0, wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } };
P.setBaseline(S6, polW);
const L1 = L.Z.L1, sg = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);
const T = (s) => Math.round(Date.parse(s) / 864e5);

// ---------- ряды фондового рынка на календарной оси ----------
const MK = JSON.parse(fs.readFileSync(__dirname + '/cache/st_mkt.json', 'utf8'));
const T0 = T('2009-01-01'), T1 = T('2027-01-01'), NT = T1 - T0;
// торговые ряды: {t: [...], c: [...]} ; календарные: Float64Array по t − T0 (ffill)
const TR = {}; for (const s in MK) TR[s] = { t: MK[s].d.map(T), c: MK[s].c };
function cal(tr) { const a = new Float64Array(NT).fill(NaN); let k = 0, last = NaN; for (let i = 0; i < NT; i++) { const t = T0 + i; while (k < tr.t.length && tr.t[k] <= t) { last = tr.c[k]; k++; } a[i] = last; } return a; }
// величина по торговым дням → календарная ось (ffill)
function calv(tr, v) { return cal({ t: tr.t, c: v }); }
const smaR = (tr, w) => { const n = tr.c.length, o = new Array(n).fill(NaN); let s = 0; for (let i = 0; i < n; i++) { s += tr.c[i]; if (i >= w) s -= tr.c[i - w]; if (i >= w - 1) o[i] = tr.c[i] / (s / w); } return o; };
const ddR = (tr, w) => { const n = tr.c.length, o = new Array(n).fill(NaN); for (let i = 0; i < n; i++) { let m = 0; for (let k = Math.max(0, i - w + 1); k <= i; k++) m = Math.max(m, tr.c[k]); o[i] = (1 - tr.c[i] / m) * 100; } return o; };
const chg = (a, d, mode = 'pct') => { const o = new Float64Array(NT).fill(NaN); for (let i = d; i < NT; i++) o[i] = mode === 'pct' ? (a[i] / a[i - d] - 1) * 100 : a[i] - a[i - d]; return o; };
const C = {}; for (const s in TR) C[s] = cal(TR[s]);
// BTC (Yahoo, с 2014-09-17): ../dca/cache/BTC-USD.csv, как в h2_lib
const csv = fs.readFileSync(__dirname + '/../dca/cache/BTC-USD.csv', 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const BTC = new Float64Array(NT).fill(NaN); for (const [d, x] of csv) { const i = T(d) - T0; if (i >= 0 && i < NT && +x > 0) BTC[i] = +x; }
const M = {}; // рыночные индикаторы на календарной оси
const NDX = '^NDX', SPX = '^GSPC';
M.st_spx200 = calv(TR[SPX], smaR(TR[SPX], 200)); M.st_ndx200 = calv(TR[NDX], smaR(TR[NDX], 200)); M.st_ndx50 = calv(TR[NDX], smaR(TR[NDX], 50));
for (const d of [7, 30, 90]) M['st_ndxr' + d] = chg(C[NDX], d); M.st_spxr7 = chg(C[SPX], 7); M.st_spxr30 = chg(C[SPX], 30);
M.st_ndxdd = calv(TR[NDX], ddR(TR[NDX], 252)); M.st_spxdd = calv(TR[SPX], ddR(TR[SPX], 252));
M.st_vix = C['^VIX']; M.st_vixr = calv(TR['^VIX'], smaR(TR['^VIX'], 50));
M.st_dxy200 = calv(TR['DX-Y.NYB'], smaR(TR['DX-Y.NYB'], 200)); M.st_dxyr30 = chg(C['DX-Y.NYB'], 30); M.st_dxyr90 = chg(C['DX-Y.NYB'], 90);
M.st_tnxd30 = chg(C['^TNX'], 30, 'abs'); M.st_tnxd90 = chg(C['^TNX'], 90, 'abs');
M.st_gld200 = calv(TR['GC=F'], smaR(TR['GC=F'], 200)); M.st_gldr90 = chg(C['GC=F'], 90);
M.st_nvda200 = calv(TR.NVDA, smaR(TR.NVDA, 200)); M.st_nvdar30 = chg(C.NVDA, 30);
// корреляция серии (календарь) с NDX по торговым дням NDX за w торговых дней
function corrNdx(S, w) {
  const tr = TR[NDX], n = tr.t.length, rx = new Array(n).fill(NaN), ry = new Array(n).fill(NaN), o = new Array(n).fill(NaN);
  for (let k = 1; k < n; k++) { const a = tr.t[k - 1] - T0, b = tr.t[k] - T0; if (a < 0 || b >= NT) continue; rx[k] = Math.log(tr.c[k] / tr.c[k - 1]); ry[k] = Math.log(S[b] / S[a]); }
  for (let k = w; k < n; k++) { let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0; for (let q = k - w + 1; q <= k; q++) { const x = rx[q], y = ry[q]; if (!isFinite(x) || !isFinite(y)) continue; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++; }
    if (m >= w * 0.8) { const cv = sxy / m - (sx / m) * (sy / m), vx = sxx / m - (sx / m) ** 2, vy = syy / m - (sy / m) ** 2; o[k] = cv / Math.sqrt(vx * vy); } }
  return calv(tr, o);
}
const rel = (S, d) => { const o = new Float64Array(NT).fill(NaN); for (let i = d; i < NT; i++) o[i] = (Math.log(S[i] / S[i - d]) - Math.log(C[NDX][i] / C[NDX][i - d])) * 100; return o; };
// BTC — с ffill по дням, где ряда нет
{ let last = NaN; for (let i = 0; i < NT; i++) { if (isFinite(BTC[i])) last = BTC[i]; else BTC[i] = last; } }
M.st_bxr30 = rel(BTC, 30); M.st_bxr90 = rel(BTC, 90);
{ const o = new Float64Array(NT).fill(NaN), lr = Float64Array.from(BTC, (b, i) => Math.log(b / C[NDX][i])); let s = 0, m = 0; for (let i = 0; i < NT; i++) { const x = lr[i]; if (i >= 200 && isFinite(lr[i - 200])) { s -= lr[i - 200]; m--; } if (isFinite(x)) { s += x; m++; } if (m >= 200) o[i] = (x - s / m) * 100; } M.st_bxz = o; }
M.st_bxc30 = corrNdx(BTC, 30); M.st_bxc90 = corrNdx(BTC, 90);
{ const o = new Float64Array(NT).fill(NaN); for (let i = 365; i < NT; i++) { let mx = 0; for (let k = i - 364; k <= i; k++) mx = Math.max(mx, BTC[k]); if (!isFinite(M.st_ndxdd[i]) || !isFinite(mx)) continue; o[i] = M.st_ndxdd[i] < 3 && BTC[i] / mx < 0.75 ? 1 : 0; } M.st_bxdiv = o; }
// раскладка по монетам
const at = (A, t) => { const i = t - T0; return i >= 0 && i < NT ? A[i] : NaN; };
for (const k in M) L.addInd(k, (X) => Float64Array.from(X.ind.t, (t) => at(M[k], t)));
L.addInd('st_cxr30', (X) => { const a = new Float64Array(X.n).fill(NaN); for (let j = 30; j < X.n; j++) a[j] = (Math.log(X.c[j] / X.c[j - 30]) - Math.log(at(C[NDX], X.ind.t[j]) / at(C[NDX], X.ind.t[j - 30]))) * 100; return a; });
L.addInd('st_cxr90', (X) => { const a = new Float64Array(X.n).fill(NaN); for (let j = 90; j < X.n; j++) a[j] = (Math.log(X.c[j] / X.c[j - 90]) - Math.log(at(C[NDX], X.ind.t[j]) / at(C[NDX], X.ind.t[j - 90]))) * 100; return a; });
L.addInd('st_cxc90', (X) => { const S = new Float64Array(NT).fill(NaN); for (let j = 0; j < X.n; j++) { const i = X.ind.t[j] - T0; if (i >= 0 && i < NT) S[i] = X.c[j]; } const cc = corrNdx(S, 90); return Float64Array.from(X.ind.t, (t) => at(cc, t)); });

// ---------- оценка ----------
const BY = H.BY, MINE = H.MINE;
const E = (X, S, pol = polW) => Math.min(P.edge(X, S, 0, 'full', false, pol).e, P.edge(X, S, 1, 'full', false, pol).e);
// половины: доход (Σ лог-медиан h1/h2) к основе
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
function halves(r) { const { BR } = P.baseline(); const o = {}; for (const h of ['h1', 'h2']) { let d = 0; for (const g of ['sel', 'ex', 'rnd']) d += L1(med(r.R[g].map((x) => x[h]))) - L1(med(BR[g].map((x) => x[h]))); o[h] = d; } return o; }
const m81 = (r) => { const { BR } = P.baseline(); return L.Z.mlog(r.R, BR, 'all', ['sel', 'ex', 'rnd']); };
function ev(nm, S, pol = polW, { quiet = false, n100 = true } = {}) {
  const r = L.run(nm, S, pol, { n100, quiet: true }); r.hv = halves(r); r.m81 = m81(r);
  r.s = `${nm.padEnd(46)} ${['sel', 'ex', 'rnd'].map((g) => Math.round(r.RS[g].all.med)).join('/')} | ${sg(r.dseg.all)} к${sg(r.dseg.big)} а${sg(r.dseg.alt)} м${sg(r.dseg.meme)} ${r.w ? '✗' : '✔'}` +
    ` | 81 ${sg(r.m81.m, 4)} ${r.m81.u}/${r.m81.d}` + (r.n100 ? ` | 100н ${sg(r.n100.m, 4)} ${r.n100.u}/${r.n100.d}` : '') + ` | пол ${sg(r.hv.h1, 2)}/${sg(r.hv.h2, 2)}` + (r.w ? ' | ' + r.w.slice(0, 140) : '');
  r.ok = !r.w && r.dseg.all > 0 && (!r.n100 || (r.n100.m > 0 && r.n100.u >= r.n100.d)) && r.hv.h1 >= -1e-9 && r.hv.h2 >= -1e-9;
  if (!quiet) console.log(r.s + (r.ok ? '  ★' : ''));
  return r;
}
// вставить правила перед индексом k (0-based) в список S6 (по умолчанию)
function ins(rules, k, S = S6) { const Q = L.clone(S); Q.rules.splice(k, 0, ...rules.map((r) => JSON.parse(JSON.stringify(r)))); return Q; }
// перед каждым правилом, где pick(r, k) → true, вставить копию mod(копия) (null — не вставлять)
function preMod(pick, mod, S = S6) { const Q = L.clone(S); Q.rules = S.rules.flatMap((r, k) => { const r0 = JSON.parse(JSON.stringify(r)); if (!pick(r, k)) return [r0]; const m = mod(JSON.parse(JSON.stringify(r)), k); return m ? [m, r0] : [r0]; }); return Q; }
// добавить условия ко всем правилам, где pick(r, k) → true (правило срабатывает реже)
function gate(pick, conds, S = S6) { const Q = L.clone(S); Q.rules.forEach((r, k) => { if (pick(S.rules[k], k)) r.conds.push(...conds.map((x) => ({ ...x }))); }); return Q; }
// монеты пользователя: итог к DCA (вся история, худший из сдвигов 0/1)
function mine(S, pol = polW, S0 = S6) { return MINE.map((nm) => { const X = BY[nm]; if (!X) return { nm, miss: 1 }; return { nm, b: E(X, S0, polW), x: E(X, S, pol) }; }); }
const mineTxt = (rows) => rows.map((r) => (r.miss ? `${r.nm}: нет` : `${r.nm} ${Math.round(r.b)}→${Math.round(r.x)} (${sg(L1(r.x) - L1(r.b), 3)})`)).join(', ');
// семьи правил combo6 (номера с 1): покупки 1–9, охрана 10–11, продажи на страхе 12–27, разворот 28, фандинг 29–31, qt 32–39, вершина 40–59, 60 покупка, памп 61–69, 70 альты, эйфория 71–76
const FAM = (q) => (q <= 8 ? 'buy' : q <= 10 ? 'guard' : q <= 26 ? 'fear' : q === 27 ? 'rev' : q <= 30 ? 'fund' : q <= 38 ? 'qt' : q <= 58 ? 'top' : q === 59 ? 'b60' : q <= 68 ? 'pump' : q === 69 ? 'alt' : 'euph'); // q — индекс 0-based
const ALL = () => { const XS = []; for (const g of ['sel', 'ex', 'rnd', 'n100']) XS.push(...G[g]); return XS; };
module.exports = { H, L, P, G, c, S6, polW, ld, M, C, TR, BTC, T0, T, at, ev, ins, preMod, gate, mine, mineTxt, BY, MINE, E, halves, m81, sg, L1, FAM, ALL, day: L.day };
