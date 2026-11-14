/* Агент 4E: новые ряды рынка (found/agent4e_data.json) в быстрый оценщик agent_sim/agent2_sim.
   Ряды сопоставляются с днями монеты по дате (как btcp в agent2_sim); до начала ряда — NaN, поэтому правило с новым индикатором
   «молчит» там, где данных нет, и не ломает старую историю. Пропуски внутри ряда (выходные у макро, сбои архива) — последнее значение
   не дольше 5 дней. Все производные считаются только по прошлому.
   Использование: const E = require('./agent4e_sim.js'); const G = E.groups(); const base = E.ev(G, E.W25); ... */
const A = require('./agent2_sim.js');
const fs = require('fs');
const W25 = JSON.parse(fs.readFileSync(__dirname + '/found/agent2-best.json', 'utf8'));
const D = JSON.parse(fs.readFileSync(__dirname + '/found/agent4e_data.json', 'utf8'));
const at = new Map(); D.t.forEach((t, i) => at.set(t, i));
const T0 = D.t[0], T1 = D.t[D.t.length - 1];
// календарный ряд (каждый день от T0 до T1) с переносом последнего значения не дольше lim дней
function cal(key, lim = 5) {
  const n = T1 - T0 + 1, o = new Float64Array(n).fill(NaN), src = D[key]; let last = NaN, age = 1e9;
  for (let d = 0; d < n; d++) { const i = at.get(T0 + d); const v = i == null ? null : src[i]; if (v != null) { last = v; age = 0; } else age++; o[d] = age <= lim ? last : NaN; }
  return o;
}
const sumW = (a, w) => a.map((x, i) => { if (i < w - 1) return NaN; let s = 0; for (let j = i - w + 1; j <= i; j++) s += a[j]; return s; });
const meanW = (a, w) => sumW(a, w).map((x) => x / w);
const chg = (a, w) => a.map((x, i) => (i >= w ? (x / a[i - w] - 1) * 100 : NaN));
const dif = (a, w) => a.map((x, i) => (i >= w ? x - a[i - w] : NaN));
const maxW = (a, w) => a.map((x, i) => { let m = -Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] > m) m = a[j]; return i >= w - 1 ? m : NaN; });
const minW = (a, w) => a.map((x, i) => { let m = Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] < m) m = a[j]; return i >= w - 1 ? m : NaN; });
const med = (v) => { const s = v.filter((x) => !isNaN(x)).sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

// ---------- календарные индикаторы ----------
const CAL = {};
function build() {
  const n = T1 - T0 + 1;
  // фандинг альтов: медиана 30-/7-дн. сумм по доступным монетам (нужно ≥ 3 монет)
  const ALTS = ['SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'LTC', 'AVAX', 'DOT', 'TRX', 'BCH', 'ETC'].filter((s) => D['f_' + s]);
  for (const w of [7, 30]) {
    const S = ALTS.map((s) => sumW(cal('f_' + s, 2), w));
    CAL['afund' + w] = Float64Array.from({ length: n }, (_, i) => { const v = S.map((a) => a[i]).filter((x) => !isNaN(x)); return v.length >= 3 ? med(v) : NaN; });
  }
  const ef = cal('f_ETH', 2); CAL.efund7 = Float64Array.from(sumW(ef, 7)); CAL.efund30 = Float64Array.from(sumW(ef, 30));
  const bf = cal('f_BTC', 2); CAL.bfund7 = Float64Array.from(sumW(bf, 7));
  // базис: премия фьючерса к индексу, % (дневное закрытие), средняя 7/30 дней
  for (const k of ['btc', 'eth']) { const p = cal('prem_' + k, 3); CAL['prem7' + k[0]] = Float64Array.from(meanW(p, 7)); CAL['prem30' + k[0]] = Float64Array.from(meanW(p, 30)); }
  // ETH: OI в монетах к 30-дн. максимуму (вынос плеч ETH), изменение OI за 30 дней, тейкеры, лонги/шорты к средней 90
  const fix = (a) => { let last = NaN; return a.map((x) => { if (x > 0 && !(x < 0.7 * last)) { last = x; return x; } return last; }); };
  const eo = fix(cal('eoic', 3)); CAL.eoidd30 = Float64Array.from(eo.map((x, i) => (x / maxW(eo, 30)[i] - 1) * 100)); CAL.eoic30 = Float64Array.from(chg(eo, 30));
  CAL.etaker7 = Float64Array.from(meanW(cal('etaker', 3), 7));
  const els = cal('els', 3), m90 = meanW(els, 90); CAL.elsr = Float64Array.from(els.map((x, i) => x / m90[i]));
  // стейблкоины: рост капитализации за 30/90 дней, %; TVL DeFi за 30/90 дней
  const st = cal('stab', 3); for (const w of [14, 30, 90]) CAL['stab' + w] = Float64Array.from(chg(st, w));
  const tv = cal('tvl', 3); for (const w of [30, 90]) CAL['tvl' + w] = Float64Array.from(chg(tv, w));
  // хешрейт: «ленты» (средняя 30 / средняя 60), дни с последнего пересечения вниз, восстановление после капитуляции майнеров
  const h = cal('hash', 7), h30 = meanW(h, 30), h60 = meanW(h, 60); CAL.hrib = Float64Array.from(h30.map((x, i) => x / h60[i]));
  { const a = new Float64Array(n); let s = 1e9; for (let i = 0; i < n; i++) { s = CAL.hrib[i] < 1 ? 0 : s + 1; a[i] = s; } CAL.hribup = a; }   // дней подряд ленты вверх (0 — сейчас капитуляция)
  CAL.hash90 = Float64Array.from(chg(h30, 90));
  // комиссии и выручка майнеров к годовой средней (перегрев сети), активные адреса к годовой средней
  for (const [k, src, lim] of [['fees', 'fees', 7], ['rev', 'rev', 7], ['adrb', 'adr_btc', 3], ['adre', 'adr_eth', 3]]) {
    const a = cal(src, lim), m30 = meanW(a, 30), m365 = meanW(a, 365); CAL[k + 'r'] = Float64Array.from(m30.map((x, i) => x / m365[i]));
  }
  CAL.mvrve = cal('mvrv_eth', 3);
  // макро: доходность 10 лет — изменение за 90 дней (п.п.), кривая 10л − 3м, доллар — изменение за 90 дней, %
  const y10 = cal('y10', 5), y3m = cal('y3m', 5), y2 = cal('y2', 5), dx = cal('dxy', 5);
  CAL.y10d90 = Float64Array.from(dif(y10, 90)); CAL.y2d90 = Float64Array.from(dif(y2, 90)); CAL.curve = Float64Array.from(y10.map((x, i) => x - y3m[i]));
  CAL.dxy90 = Float64Array.from(chg(dx, 90)); CAL.dxy30 = Float64Array.from(chg(dx, 30)); CAL.dxys = Float64Array.from(dx.map((x, i) => x / meanW(dx, 200)[i]));
}
build();
const NEW = Object.keys(CAL);
// календарные индикаторы на дни монеты
function addNew(X) {
  if (X.ind.afund30) return;
  for (const k of NEW) { const a = new Float64Array(X.n), s = CAL[k]; for (let i = 0; i < X.n; i++) { const d = X.t[i] - T0; a[i] = d >= 0 && d < s.length ? s[d] : NaN; } X.ind[k] = a; }
  for (const f of EXTRA4) f(X);
}
const EXTRA4 = [];
A.EXTRA.push(addNew);
const groups = (list) => A.groups(list);

// ---------- событийный разбор по календарю BTC/ETH ----------
let PX = null;
function px() {
  if (PX) return PX;
  const pg = A.S.loadPage('strategy-builder-sol'); PX = {};
  for (const nm of ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB']) { const X = pg.find((x) => x.name === nm); const a = new Float64Array(T1 - T0 + 1).fill(NaN); for (let i = 0; i < X.n; i++) { const d = X.t[i] - T0; if (d >= 0 && d < a.length) a[d] = X.c[i]; } PX[nm] = a; }
  return PX;
}
// эпизоды: дни, где cond(d) истинно, склеенные с разрывом < gap дней; для каждого — вход в первый день, будущая доходность за h дней,
// глубина ниже входа (минимум за h дней) и где вход относительно минимума/максимума ±90 дней
function episodes(cond, { from = 0, gap = 30, hs = [30, 90, 180], coin = 'BTC' } = {}) {
  const P = px()[coin], n = P.length, E = []; let last = -1e9, cur = null;
  for (let d = Math.max(from, 0); d < n; d++) {
    if (isNaN(P[d]) || !cond(d)) continue;
    if (d - last >= gap) { cur = { d, days: 0 }; E.push(cur); }
    cur.days++; last = d;
  }
  for (const e of E) {
    const p = P[e.d]; e.date = new Date((T0 + e.d) * 864e5).toISOString().slice(0, 10); e.p = p;
    for (const h of hs) e['r' + h] = e.d + h < n && !isNaN(P[e.d + h]) ? (P[e.d + h] / p - 1) * 100 : NaN;
    let lo = Infinity, hi = 0; for (let j = Math.max(0, e.d - 90); j <= Math.min(n - 1, e.d + 90); j++) { if (P[j] < lo) lo = P[j]; if (P[j] > hi) hi = P[j]; }
    e.fromLo = (p / lo - 1) * 100; e.toHi = (p / hi) * 100;
  }
  return E;
}
// безусловная база для сравнения: средняя доходность случайного дня за тот же период
function baseRet(h, from = 0, coin = 'BTC') { const P = px()[coin], v = []; for (let d = from; d + h < P.length; d++) if (!isNaN(P[d]) && !isNaN(P[d + h])) v.push((P[d + h] / P[d] - 1) * 100); return med(v); }
const fmtEp = (E, hs = [30, 90, 180]) => E.map((e) => `${e.date}(${e.days}д) ${hs.map((h) => (isNaN(e['r' + h]) ? '   —' : (e['r' + h] >= 0 ? '+' : '') + e['r' + h].toFixed(0))).join('/')} от дна±90 +${e.fromLo.toFixed(0)}% к верш.${e.toHi.toFixed(0)}%`).join('\n    ');
const sumEp = (E, h = 90) => { const v = E.map((e) => e['r' + h]).filter((x) => !isNaN(x)); return { n: E.length, pos: v.filter((x) => x > 0).length, med: med(v), fromLo: med(E.map((e) => e.fromLo)), toHi: med(E.map((e) => e.toHi)) }; };
const dayOf = (s) => Math.round(Date.parse(s) / 864e5) - T0;
module.exports = { ...A, A, W25, CAL, NEW, groups, episodes, baseRet, fmtEp, sumEp, px, T0, T1, dayOf, EXTRA4, D, cal, med };
