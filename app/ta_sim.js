/* Агент «ТЕХАНАЛИЗ»: помощники поверх combo_sim.js (быстрый оценщик agent_sim.js). Основа — found/combo-best.json (F + C1.25 + C6).
   Индикаторы теханализа (только прошлое):
   - по монете (из закрытий c, максимумов h, минимумов l дня и объёма к своей 20-дн. средней vol): sma20r, bbw/bbwp (ширина полос Боллинджера
     и её перцентиль за 180 дн. — сжатие), atrp (ATR14 в % цены), macdh (гистограмма MACD 12/26/9 в % цены), wrsi (недельный RSI14 по закрытиям
     каждые 7 дней), w20/w50 (цена к 20/50-недельной средней = 140/350 дн.), don90 (место в 90-дн. диапазоне 0…1), brk55 (закрытие выше
     максимума прошлых 55 дней), wick (нижняя тень: (min(c, c вчера) − l)/(h − l)), dvg (бычье расхождение RSI: цена на 30-дн. минимуме ниже,
     чем на прошлом минимуме 10–60 дней назад, а RSI выше на 5+), fib (место цены между минимумом и максимумом за 730 дней, 0…1);
   - по BTC (считаются по полной истории BTC со страницы отбора и сопоставляются по дню): b_rsi, b_wrsi, b_w200 (BTC к 200-недельной средней),
     b_w50, b_w20, b_bbz, b_macdh, b_don90, b_brk90 (BTC закрылся на новом 90-дн. максимуме), b_atrp, b_bbwp, b_vol (объём BTC к 20-дн. средней),
     b_hl (структура недельных минимумов: последний 4-недельный минимум выше предыдущего = 1).
   Использование: const T = require('./ta_sim.js'); const G = T.load(); const r = T.ev(G, T.BASE) */
const K = require('./combo_sim.js');
const S0 = require('./agent_sim.js');
const fs = require('fs');
const { c } = K;
const BASE = (() => { const j = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8')); return { base: j.base, rules: j.rules }; })();

const sma = (a, w) => { const n = a.length, o = new Float64Array(n); let s = 0, k = 0; for (let i = 0; i < n; i++) { s += a[i]; if (i >= w) s -= a[i - w]; o[i] = i >= w - 1 ? s / w : NaN; } return o; };
const ema = (a, w) => { const n = a.length, o = new Float64Array(n), k = 2 / (w + 1); let e = NaN; for (let i = 0; i < n; i++) { e = isNaN(e) ? a[i] : a[i] * k + e * (1 - k); o[i] = e; } return o; };
const sd = (a, w) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { if (i < w - 1) { o[i] = NaN; continue; } let s = 0, q = 0; for (let j = i - w + 1; j <= i; j++) { s += a[j]; q += a[j] * a[j]; } const m = s / w; o[i] = Math.sqrt(Math.max(0, q / w - m * m)); } return o; };
function rsiOf(a, w = 14) { const n = a.length, o = new Float64Array(n).fill(NaN); let g = 0, l = 0; for (let i = 1; i < n; i++) { const d = a[i] - a[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0); if (i <= w) { g += up / w; l += dn / w; if (i === w) o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); continue; } g = (g * (w - 1) + up) / w; l = (l * (w - 1) + dn) / w; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } return o; }
const rollMax = K.A.rollMax || ((a, w) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] > m) m = a[j]; o[i] = m; } return o; });
const rollMin = K.A.rollMin || ((a, w) => { const n = a.length, o = new Float64Array(n); for (let i = 0; i < n; i++) { let m = Infinity; for (let j = Math.max(0, i - w + 1); j <= i; j++) if (a[j] < m) m = a[j]; o[i] = m; } return o; });
// недельный ряд: закрытие каждые 7 дней (по дню t, неделя кончается в день t % 7 === 3, т. е. воскресенье), значение держится до следующего закрытия недели
function weekly(t, a, f) {
  const n = a.length, idx = []; for (let i = 0; i < n; i++) if (t[i] % 7 === 3) idx.push(i);
  const w = idx.map((i) => a[i]), v = f(Float64Array.from(w)), o = new Float64Array(n).fill(NaN);
  let k = -1; for (let i = 0; i < n; i++) { while (k + 1 < idx.length && idx[k + 1] <= i) k++; o[i] = k >= 0 ? v[k] : NaN; }
  return o;
}
// по-недельная средняя к цене: цена сегодня / средняя последних N недельных закрытий
function wRatio(t, a, N) { const n = a.length, idx = []; for (let i = 0; i < n; i++) if (t[i] % 7 === 3) idx.push(i); const o = new Float64Array(n).fill(NaN); let k = -1; for (let i = 0; i < n; i++) { while (k + 1 < idx.length && idx[k + 1] <= i) k++; if (k >= N - 1) { let s = 0; for (let q = k - N + 1; q <= k; q++) s += a[idx[q]]; o[i] = a[i] / (s / N); } } return o; }
function pctRank(a, w) { const n = a.length, o = new Float64Array(n).fill(NaN); for (let i = w - 1; i < n; i++) { if (isNaN(a[i])) continue; let lo = 0, k = 0; for (let j = i - w + 1; j <= i; j++) if (!isNaN(a[j])) { k++; if (a[j] < a[i]) lo++; } o[i] = k > w * 0.8 ? lo / k : NaN; } return o; }

// набор индикаторов ТА для ряда (c, h, l, vol, t); prefix '' — монета, 'b_' — BTC
function taSet(t, c, h, l, vol, p) {
  const n = c.length, o = {};
  const s20 = sma(c, 20), d20 = sd(c, 20);
  o[p + 'sma20r'] = c.map((x, i) => x / s20[i]);
  o[p + 'bbz'] = c.map((x, i) => (d20[i] > 0 ? (x - s20[i]) / d20[i] : NaN));
  const bbw = c.map((x, i) => (4 * d20[i]) / s20[i]); o[p + 'bbw'] = bbw; o[p + 'bbwp'] = pctRank(bbw, 180);
  const tr = new Float64Array(n); for (let i = 0; i < n; i++) { const hi = Math.max(h[i] || c[i], c[i]), lo = Math.min(l[i] || c[i], c[i]), pc = i ? c[i - 1] : c[i]; tr[i] = Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc)); }
  const atr = ema(tr, 27); o[p + 'atrp'] = c.map((x, i) => (i >= 14 ? (100 * atr[i]) / x : NaN));
  const m1 = ema(c, 12), m2 = ema(c, 26), mac = c.map((x, i) => m1[i] - m2[i]), sig = ema(mac, 9);
  o[p + 'macdh'] = c.map((x, i) => (i >= 35 ? (100 * (mac[i] - sig[i])) / x : NaN));
  o[p + 'macd'] = c.map((x, i) => (i >= 35 ? (100 * mac[i]) / x : NaN));
  o[p + 'rsi'] = rsiOf(c, 14);
  o[p + 'wrsi'] = weekly(t, c, (w) => rsiOf(w, 14));
  o[p + 'w20'] = wRatio(t, c, 20); o[p + 'w50'] = wRatio(t, c, 50); o[p + 'w200'] = wRatio(t, c, 200);
  const mx90 = rollMax(c, 90), mn90 = rollMin(c, 90);
  o[p + 'don90'] = c.map((x, i) => (i >= 89 && mx90[i] > mn90[i] ? (x - mn90[i]) / (mx90[i] - mn90[i]) : NaN));
  for (const N of [20, 55, 90]) { const mx = rollMax(c, N); o[p + 'brk' + N] = c.map((x, i) => (i >= N && x > mx[i - 1] ? 1 : 0)); }
  o[p + 'wick'] = c.map((x, i) => { if (!i) return NaN; const hi = Math.max(h[i] || x, x, c[i - 1]), lo = Math.min(l[i] || x, x), rg = hi - lo; return rg > 0 ? (Math.min(x, c[i - 1]) - lo) / rg : 0; });
  o[p + 'uwick'] = c.map((x, i) => { if (!i) return NaN; const hi = Math.max(h[i] || x, x), lo = Math.min(l[i] || x, x, c[i - 1]), rg = hi - lo; return rg > 0 ? (hi - Math.max(x, c[i - 1])) / rg : 0; });
  if (vol) o[p + 'vol'] = vol;
  // бычье расхождение RSI: сегодня закрытие — минимум за 30 дней, и был минимум за 10–60 дней назад выше по цене, но с RSI ниже на 5+
  { const r = o[p + 'rsi'], mn30 = rollMin(c, 30), dv = new Float64Array(n); for (let i = 60; i < n; i++) { if (c[i] > mn30[i]) continue; let jb = -1; for (let j = i - 60; j <= i - 10; j++) if (jb < 0 || c[j] < c[jb]) jb = j; if (jb >= 0 && c[jb] > c[i] && r[i] > r[jb] + 5) dv[i] = 1; } o[p + 'dvg'] = dv; }
  { const r = o[p + 'rsi'], mx30 = rollMax(c, 30), dv = new Float64Array(n); for (let i = 60; i < n; i++) { if (c[i] < mx30[i]) continue; let jb = -1; for (let j = i - 60; j <= i - 10; j++) if (jb < 0 || c[j] > c[jb]) jb = j; if (jb >= 0 && c[jb] < c[i] && r[i] < r[jb] - 5) dv[i] = 1; } o[p + 'bdvg'] = dv; }
  // Фибоначчи: место между минимумом и максимумом за 730 дней (0 — у минимума, 1 — у максимума)
  { const mx = rollMax(c, 730), mn = rollMin(c, 730); o[p + 'fib'] = c.map((x, i) => (i >= 364 && mx[i] > mn[i] ? (x - mn[i]) / (mx[i] - mn[i]) : NaN)); }
  // структура недельных минимумов: минимум последних 4 недель выше минимума 4 недель до них (higher low) и закрытие выше максимума 4 недель до них
  { const lo28 = rollMin(l.map((v, i) => v || c[i]), 28), hi28 = rollMax(h.map((v, i) => v || c[i]), 28); o[p + 'hl'] = c.map((x, i) => (i >= 56 && lo28[i] > lo28[i - 28] ? 1 : 0)); o[p + 'hh'] = c.map((x, i) => (i >= 56 && hi28[i] > hi28[i - 28] ? 1 : 0)); }
  return o;
}
let BT = null;
function btcTA() {
  if (BT) return BT;
  const X = S0.loadPage('strategy-builder-sol').find((x) => x.name === 'BTC');
  const o = taSet(X.t, Array.from(X.c), Array.from(X.h), Array.from(X.l), Array.from(X.ind.vol), 'b_');
  BT = { map: new Map(), keys: Object.keys(o) }; for (let i = 0; i < X.n; i++) BT.map.set(X.t[i], i); BT.o = o; return BT;
}
function addTA(X) {
  if (X.ind.t_sma20r) return;
  const o = taSet(X.t, Array.from(X.c), Array.from(X.h), Array.from(X.l), null, 't_');
  for (const k in o) X.ind[k] = Float64Array.from(o[k]);
  const B = btcTA();
  for (const k of B.keys) { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const j = B.map.get(X.t[i]); a[i] = j == null ? NaN : B.o[k][j]; } X.ind[k] = a; }
}
function load(list = ['sel', 'ex', 'rnd', 'n100']) { const G = K.groups(list); K.prep(G); for (const g in G) for (const X of G[g]) addTA(X); return G; }
const ev = (G, S, withM = true) => K.ev(G, S, withM);
// копия правила перед исходным с доп. условиями и новой долей (a — новая act)
const pre = (S, which, conds, act) => ({ ...S, rules: S.rules.flatMap((r, i) => (which(r, i) ? [{ act: typeof act === 'function' ? act(r) : act ?? r.act, conds: [...r.conds, ...conds] }, r] : [r])) });
// добавить условия к правилам (фильтр): правило срабатывает только при условиях; иначе день уходит дальше по списку
const addC = (S, which, conds) => ({ ...S, rules: S.rules.map((r, i) => (which(r, i) ? { ...r, conds: [...r.conds, ...conds] } : r)) });
const has = (r, ind, op, v) => r.conds.some((x) => x.ind === ind && (op == null || x.op === op) && (v == null || x.v === v));
// классы правил основы
const isPanic = (r) => r.act > 1 && has(r, 'usdt', '>', 1.07);
const isRev = (r) => r.act > 1 && has(r, 'btcr30');
const isFearSell = (r) => r.act < 0 && has(r, 'fng', '<', 52);
const isSell = (r) => r.act < 0;
const isBuy = (r) => r.act > 1;
const rowS = (t, r, b) => { const [bb, ww] = K.bw(r, b, 'n100'); return `${K.show(t, r, b)} | 100н +${bb}/−${ww}${K.passes(r, b) ? '' : ' [' + K.why(r, b) + ']'}`; };
module.exports = { K, S0, BASE, load, ev, pre, addC, has, isPanic, isRev, isFearSell, isSell, isBuy, rowS, c, taSet, btcTA, addTA, sma, ema, rsiOf, rollMax, rollMin };
